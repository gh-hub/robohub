// Renderer-world script, loaded by index.html as a native ES module
// (`<script type="module">`) — Chromium supports ESM script tags
// independent of nodeIntegration/contextIsolation, so this runs with zero
// Node access, per ADR-002. It only ever touches `window.carAPI` (the
// narrow surface preload.ts exposes via contextBridge), never Node APIs or
// raw sockets.
//
// `window.carAPI`'s type comes from preload.ts's `declare global`
// augmentation, but that file isn't part of this module's compiled program
// (it stays CommonJS for Electron's Node-based preload loader, while this
// file compiles to ESM for the browser — see tsconfig.renderer.json, and
// connectionUiState.ts's top comment for why pulling in a CommonJS file
// here would break the build). The shape below is intentionally
// re-declared to match preload.ts's `CarApi` exactly; if that contract
// ever changes, this must be updated by hand.
import {
  mapAimControlUiState,
  mapConnectionStatusToUiState,
  mapDistanceSensorControlUiState,
  mapLightControlUiState,
  mapMovementControlUiState,
  mapShootControlUiState,
  mapUsbLogControlUiState,
  type ConnectionState,
  type UsbLogState,
} from "./connectionUiState.ts";
import { appendLogLines, clearLogLines, renderLogPanel } from "./logPanel.ts";

// Redeclared locally rather than imported from commandFrame.ts — that file
// is part of the CommonJS main-process build (tsconfig.build.json); pulling
// it into this file's ES-module compilation unit (tsconfig.renderer.json)
// would hit the same dist-clobbering problem documented above for
// carConnection.ts's ConnectionState. Keep in sync with commandFrame.ts's
// `MovementDirection` by hand.
type MovementDirection = "stop" | "forward" | "backward" | "left" | "right" | "rotate-left" | "rotate-right";

interface CarApi {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  onStatus: (callback: (state: ConnectionState) => void) => () => void;
  setLights: (on: boolean) => Promise<void>;
  setMovement: (direction: MovementDirection) => Promise<void>;
  shoot: () => Promise<void>;
  setAimAngle: (angle: number) => Promise<void>;
  setDistanceSensorAngle: (angle: number) => Promise<void>;
  onUsbStatus: (callback: (connected: boolean) => void) => () => void;
  onWifiLogLines: (callback: (lines: string[]) => void) => () => void;
  usbLogConnect: () => Promise<void>;
  usbLogDisconnect: () => Promise<void>;
  onUsbLogStatus: (callback: (state: UsbLogState) => void) => () => void;
  onUsbLogLines: (callback: (lines: string[]) => void) => () => void;
}

declare global {
  interface Window {
    carAPI: CarApi;
  }
}

// No initial-state query exists on window.carAPI (see implement-03 notes
// gotcha 8) — a fresh CarConnection always starts disconnected, so that's
// the safe default until the first onStatus push arrives.
let currentState: ConnectionState = { status: "disconnected", protocol: null, message: null };

// On/off state for the single Lights button. App-tracked/optimistic only:
// the protocol has no state-readback channel, so this never reflects a query
// of the hardware, only what the app last told it to do.
let lightsOn = false;

// The one direction currently being sent (or null when stopped), per
// grill/decisions.md's "interrupt semantics with active-direction
// matching" decision. A new pointerdown overwrites this immediately
// (interrupt, not queue); a stop-trigger event only sends Stop and clears
// this if it matches the button that set it — a stale release from an
// already-superseded button is a no-op.
let activeDirection: Exclude<MovementDirection, "stop"> | null = null;

const MOVEMENT_BUTTON_IDS: Record<Exclude<MovementDirection, "stop">, string> = {
  forward: "move-forward",
  backward: "move-backward",
  left: "move-left",
  right: "move-right",
  "rotate-left": "rotate-left",
  "rotate-right": "rotate-right",
};

// The four one-click discrete-rotate buttons, distinct from the continuous
// rotate-left/rotate-right D-pad buttons above (which spin only while held).
// Single source of truth for both renderMovement()'s disabled-state loop and
// the click-listener wiring at the bottom of this file.
const DISCRETE_ROTATE_BUTTONS: ReadonlyArray<{
  id: string;
  direction: "left" | "right";
  angleDegrees: 90 | 180;
}> = [
  { id: "rotate-90-left-button", direction: "left", angleDegrees: 90 },
  { id: "rotate-90-right-button", direction: "right", angleDegrees: 90 },
  { id: "rotate-180-left-button", direction: "left", angleDegrees: 180 },
  { id: "rotate-180-right-button", direction: "right", angleDegrees: 180 },
];

// ~300ms = the firmware's fixed 200ms pulse + 100ms margin, per ADR-001
// (.gh-workflows/plans/20260815_083408-water-gun-control/grill/ADR-001.md).
const SHOOT_COOLDOWN_MS = 300;

// User-toggleable: whether a click disables the Shoot button for
// SHOOT_COOLDOWN_MS afterward. On by default, per ADR-001.
let shootCooldownEnabled = true;

// True for SHOOT_COOLDOWN_MS after a click when the cooldown toggle is on.
// A separate concern from connection gating (mapShootControlUiState), so
// it's combined with that gate only here in the DOM-wiring layer, not
// folded into the pure mapping function.
let shootCooldownActive = false;

type AimDirection = "up" | "down";

// Fixed 400ms repeat cadence while an aim button is held, matching the
// firmware's own ~300-400ms blocking interpolation time per ADR-001 — this
// ensures only one angle command is ever in flight, preventing TCP buffer
// backlog.
const AIM_REPEAT_INTERVAL_MS = 400;

// Step sizes in degrees per repeat tick, per ADR-001's Fast/Slow dropdown.
const AIM_STEP_DEGREES: Record<"fast" | "slow", number> = {
  fast: 10,
  slow: 5,
};

const MIN_AIM_ANGLE = 1;
const MAX_AIM_ANGLE = 180;

// App-tracked aim angle — no protocol readback exists (per ADR-001), so
// this mirrors the `lightsOn` precedent: purely what the app last told the
// servo to do. Defaults to 90, the firmware's own boot default.
let aimAngle = 90;

// User-selected step size for held-button repeats, per ADR-001's
// Fast/Slow dropdown. Fast is the default.
let aimSpeed: "fast" | "slow" = "fast";

// The aim button currently held (or null when neither is held). A new
// pointerdown on the other button interrupts the current hold, mirroring
// the movement D-pad's interrupt semantics.
let aimHoldDirection: AimDirection | null = null;

// The setInterval handle driving the throttled repeat while a button is
// held; null when nothing is held.
let aimRepeatTimer: ReturnType<typeof setInterval> | null = null;

type DistanceSensorDirection = "left" | "right";

// Mirrors AIM_REPEAT_INTERVAL_MS's reasoning exactly — the firmware has no
// handler for this device code yet (see commandFrame.ts's DEVICE_DISTANCE_SENSOR
// comment), but the same fixed-cadence contract is kept ready for when it does.
const DISTANCE_SENSOR_REPEAT_INTERVAL_MS = 400;

// Step sizes in degrees per repeat tick, mirrors AIM_STEP_DEGREES.
const DISTANCE_SENSOR_STEP_DEGREES: Record<"fast" | "slow", number> = {
  fast: 10,
  slow: 5,
};

const MIN_DISTANCE_SENSOR_ANGLE = 1;
const MAX_DISTANCE_SENSOR_ANGLE = 180;

// App-tracked distance-sensor angle — no protocol readback exists, mirrors
// aimAngle's reasoning. Defaults to 90, the assumed boot default.
let distanceSensorAngle = 90;

// User-selected step size for held-button repeats, mirrors aimSpeed.
let distanceSensorSpeed: "fast" | "slow" = "fast";

// The distance-sensor button currently held (or null when neither is held),
// mirrors aimHoldDirection.
let distanceSensorHoldDirection: DistanceSensorDirection | null = null;

// The setInterval handle driving the throttled repeat while a button is
// held; null when nothing is held. Mirrors aimRepeatTimer.
let distanceSensorRepeatTimer: ReturnType<typeof setInterval> | null = null;

// Each log panel's currently-displayed lines. Per spec.md, neither panel
// auto-clears on connect/disconnect/reconnect — only an explicit Clear click
// (or app restart) empties these — so nothing here is reset by the
// onStatus/onUsbStatus handlers below, unlike lightsOn/aimAngle. wifiLogLines
// is fed live by onWifiLogLines below; usbLogLines is fed live by
// onUsbLogLines below.
let wifiLogLines: string[] = [];
let usbLogLines: string[] = [];

// State for the USB Log panel's own Connect/Disconnect toggle button, per
// spec.md's "reuses the app's existing single-button toggle pattern"
// decision. Mirrors `currentState` above exactly: `UsbSerialConnection` now
// has the same always-resolves `connect()`/`disconnect()` contract as
// `CarConnection`, with real success/failure (connected, or an error such as
// "no CH340 adapter found") arriving via the `onUsbLogStatus` push below —
// per review round-1 fix ticket 02, replacing the app-tracked boolean this
// used to be (which had no way to show the operator *why* a Connect attempt
// failed). No initial-state query exists, so a fresh `UsbSerialConnection`
// starts `disconnected`, matching `currentState`'s same default.
let usbLogState: UsbLogState = { status: "disconnected", message: null };

function render(state: ConnectionState): void {
  const button = document.getElementById("toggle-button") as HTMLButtonElement;
  const statusText = document.getElementById("status-text") as HTMLElement;
  const uiState = mapConnectionStatusToUiState(state);

  button.textContent = uiState.buttonLabel;
  button.disabled = uiState.buttonDisabled;
  statusText.textContent = uiState.statusText;
  statusText.className = uiState.statusClass;

  renderLights(state);
  renderMovement(state);
  renderShoot(state);
  renderAim(state);
  renderDistanceSensor(state);
}

function renderLights(state: ConnectionState): void {
  const lightButton = document.getElementById("light-button") as HTMLButtonElement;
  const lightUiState = mapLightControlUiState(state, lightsOn);

  lightButton.textContent = `Lights: ${lightUiState.stateLabel}`;
  lightButton.disabled = lightUiState.disabled;
}

function renderMovement(state: ConnectionState): void {
  const movementUiState = mapMovementControlUiState(state);
  // Connection gating and the discrete-rotate pulse's timed disable are
  // independent concerns (mirrors renderShoot()'s shootCooldownActive
  // composition) — either one alone is enough to keep the whole
  // movement/rotate button set disabled, per ADR-002.
  const disabled = movementUiState.disabled || rotateCooldownActive;

  for (const id of Object.values(MOVEMENT_BUTTON_IDS)) {
    (document.getElementById(id) as HTMLButtonElement).disabled = disabled;
  }
  for (const { id } of DISCRETE_ROTATE_BUTTONS) {
    (document.getElementById(id) as HTMLButtonElement).disabled = disabled;
  }
}

// USB badge is independent of ConnectionState and has no local mirrored
// state of its own, per ADR-002 — it renders directly from whatever
// `onUsbStatus` last pushed, unlike renderLights/renderAim/etc. which mix in
// app-tracked local variables. Not part of the render(state) cycle: it must
// not be affected by, or reset alongside, Wi-Fi connect/disconnect/error
// transitions (see implement-03 notes on why the three-reset-points
// precedent doesn't apply here).
function renderUsbStatus(connected: boolean): void {
  const usbStatusText = document.getElementById("usb-status-text") as HTMLElement;
  usbStatusText.textContent = connected ? "USB: Connected" : "USB: Not connected";
  usbStatusText.className = connected ? "usb-status-connected" : "usb-status-disconnected";
}

// Thin DOM-wiring for the two log panels, per spec.md's "one small,
// reusable piece of log-panel logic shared by both panels" decision —
// each just points renderLogPanel() at its own DOM element and its own
// locally-tracked lines array.
function renderWifiLog(): void {
  const panel = document.getElementById("wifi-log-panel") as HTMLElement;
  renderLogPanel(panel, wifiLogLines);
}

function renderUsbLog(): void {
  const panel = document.getElementById("usb-log-panel") as HTMLElement;
  renderLogPanel(panel, usbLogLines);
}

function handleWifiLogClear(): void {
  wifiLogLines = clearLogLines();
  renderWifiLog();
}

function handleUsbLogClear(): void {
  usbLogLines = clearLogLines();
  renderUsbLog();
}

// Single toggle button + status text driven by `usbLogState`, mirroring the
// main Wi-Fi toggle-button's `render()` shape (see spec.md's "reuses the
// app's existing single-button toggle pattern" decision), independent of
// `currentState`/`render(state)` — the USB serial port has no relationship
// to the Wi-Fi connection lifecycle. `mapUsbLogControlUiState` is the same
// kind of pure status-to-UI mapper `mapConnectionStatusToUiState` is for the
// Wi-Fi button, so a failed Connect attempt (no CH340 detected, a port-open
// error) now has a visible statusText, not just a console.error.
function renderUsbLogControls(): void {
  const button = document.getElementById("usb-log-toggle-button") as HTMLButtonElement;
  const statusText = document.getElementById("usb-log-status-text") as HTMLElement;
  const uiState = mapUsbLogControlUiState(usbLogState);

  button.textContent = uiState.buttonLabel;
  button.disabled = uiState.buttonDisabled;
  statusText.textContent = uiState.statusText;
  statusText.className = uiState.statusClass;
}

function handleUsbLogToggleClick(): void {
  const action =
    usbLogState.status === "connected" || usbLogState.status === "connecting"
      ? window.carAPI.usbLogDisconnect()
      : window.carAPI.usbLogConnect();

  // Mirrors handleToggleClick(): rejects synchronously only for an invalid
  // current state (e.g. a stray double-click racing a status push already
  // in flight) — the real success/failure signal for the button/status text
  // is the onUsbLogStatus push below, not this promise's resolution, per
  // usbSerialConnection.ts's now-aligned contract with
  // CarConnection.connect().
  action.catch((error: unknown) => {
    console.error("USB Log connect/disconnect failed:", error);
  });
}

function renderShoot(state: ConnectionState): void {
  const shootButton = document.getElementById("shoot-button") as HTMLButtonElement;
  const shootUiState = mapShootControlUiState(state);

  // Connection gating and the cooldown's timed disable are independent
  // concerns (per ADR-001's gating decision vs. cooldown decision) — either
  // one alone is enough to keep the button disabled.
  shootButton.disabled = shootUiState.disabled || shootCooldownActive;
}

function handleToggleClick(): void {
  const action =
    currentState.status === "connected" || currentState.status === "connecting"
      ? window.carAPI.disconnect()
      : window.carAPI.connect();

  // A stray click can race a status update that already made this call
  // invalid (e.g. double-click while a connect attempt is settling) —
  // CarConnection rejects synchronously for those cases; log rather than
  // throw, since there's no further recovery action for the renderer to
  // take beyond what the next status push will already reflect.
  action.catch((error: unknown) => {
    console.error("Car connection action failed:", error);
  });
}

function handleLightToggleClick(): void {
  // Optimistic: flip and render the local mirrored state immediately, then
  // fire the IPC call — the protocol has no state-readback channel to
  // confirm against, per spec.md's "renderer-side mirrored toggle state"
  // decision.
  lightsOn = !lightsOn;
  renderLights(currentState);

  window.carAPI.setLights(lightsOn).catch((error: unknown) => {
    console.error("Set lights failed:", error);
  });
}

function renderAim(state: ConnectionState): void {
  const upButton = document.getElementById("aim-up-button") as HTMLButtonElement;
  const downButton = document.getElementById("aim-down-button") as HTMLButtonElement;
  const angleText = document.getElementById("aim-angle-text") as HTMLElement;
  const aimUiState = mapAimControlUiState(state, aimAngle);

  upButton.disabled = aimUiState.upDisabled;
  downButton.disabled = aimUiState.downDisabled;
  angleText.textContent = `Aim: ${aimAngle}°`;
}

function renderDistanceSensor(state: ConnectionState): void {
  const leftButton = document.getElementById("distance-sensor-left-button") as HTMLButtonElement;
  const rightButton = document.getElementById("distance-sensor-right-button") as HTMLButtonElement;
  const angleText = document.getElementById("distance-sensor-angle-text") as HTMLElement;
  const distanceSensorUiState = mapDistanceSensorControlUiState(state, distanceSensorAngle);

  leftButton.disabled = distanceSensorUiState.leftDisabled;
  rightButton.disabled = distanceSensorUiState.rightDisabled;
  angleText.textContent = `Distance Sensor: ${distanceSensorAngle}°`;
}

function handleShootClick(): void {
  // Click sends exactly one command; the cooldown disable is independent of
  // whether the click actually succeeds or is rejected by a race with a
  // connection-state change, per spec.md's "Shoot" interaction spec.
  window.carAPI.shoot().catch((error: unknown) => {
    console.error("Shoot failed:", error);
  });

  if (shootCooldownEnabled) {
    startShootCooldown();
  }
}

function startShootCooldown(): void {
  shootCooldownActive = true;
  renderShoot(currentState);

  setTimeout(() => {
    shootCooldownActive = false;
    renderShoot(currentState);
  }, SHOOT_COOLDOWN_MS);
}

function handleShootCooldownToggleChange(event: Event): void {
  shootCooldownEnabled = (event.target as HTMLInputElement).checked;
}

function sendMovement(direction: MovementDirection): void {
  window.carAPI.setMovement(direction).catch((error: unknown) => {
    console.error("Set movement failed:", error);
  });
}

// pointerdown always interrupts: overwrite activeDirection and send the new
// direction immediately, even if another direction is currently active, per
// grill/decisions.md's interrupt-semantics decision.
function handleMovementPointerDown(direction: Exclude<MovementDirection, "stop">): void {
  activeDirection = direction;
  sendMovement(direction);
}

// pointerup/pointerleave/pointercancel all funnel through here. Only the
// event whose direction matches the currently-tracked activeDirection may
// send Stop and clear it — a release from a since-superseded button is a
// no-op, so releasing an old button after pressing a new one doesn't stop
// the still-held new direction.
function handleMovementRelease(direction: Exclude<MovementDirection, "stop">): void {
  if (activeDirection !== direction) {
    return;
  }
  activeDirection = null;
  sendMovement("stop");
}

// Used by window.blur: the connection is still live here, so this is the
// safety net for "user alt-tabbed away while holding a direction" — not tied
// to a specific button, so any active direction (whichever it is) gets
// stopped. The firmware has no watchdog for CMD_RUN (see ADR-001).
function stopActiveMovement(): void {
  if (activeDirection === null) {
    return;
  }
  activeDirection = null;
  sendMovement("stop");
}

// Used by the onStatus connection-drop path only: once the session leaves
// connected+tcp100, CarConnection.setMovement() already rejects synchronously
// (see ADR-001/setLedState's gating contract), so sending Stop here would be
// a pointless IPC round-trip that's guaranteed to fail — this is a pure local
// state reset, not a new Stop-sending path.
function clearActiveMovement(): void {
  activeDirection = null;
}

// Placeholder pulse durations pending real hardware calibration, per
// ADR-002 — if live testing shows these are wrong, these are the two lines
// to tune, matching the same "unverified assumption" precedent as
// AIM_ANGLE_DELTA below.
const ROTATE_90_MS = 400;
const ROTATE_180_MS = 800;

// Mirrors shootCooldownActive's pattern, but unlike Shoot's cooldown (which
// disables only the Shoot button), this disables the entire movement/rotate
// button set for the pulse's duration, per ADR-002.
let rotateCooldownActive = false;

// The setTimeout handle driving the in-flight discrete-rotate pulse; null
// when no pulse is active.
let discreteRotateTimer: ReturnType<typeof setTimeout> | null = null;

// One-click pulse: interrupts any held D-pad direction/continuous rotate
// first (per grill/decisions.md's interrupt-semantics decision, extended to
// the discrete-rotate buttons by ADR-002), then spins for a fixed
// placeholder duration before stopping on its own.
function handleDiscreteRotate(direction: "left" | "right", angleDegrees: 90 | 180): void {
  stopActiveMovement();

  rotateCooldownActive = true;
  renderMovement(currentState);

  sendMovement(direction === "left" ? "rotate-left" : "rotate-right");

  const durationMs = angleDegrees === 90 ? ROTATE_90_MS : ROTATE_180_MS;
  discreteRotateTimer = setTimeout(() => {
    discreteRotateTimer = null;
    sendMovement("stop");
    rotateCooldownActive = false;
    renderMovement(currentState);
  }, durationMs);
}

// Used by window.blur: the connection is still live here, so — mirroring
// stopActiveMovement()'s reasoning — an in-flight pulse gets an explicit
// Stop sent rather than left to finish on its own, and the button set
// re-enables immediately instead of staying disabled until the original
// timer would have fired.
function stopActiveDiscreteRotate(): void {
  if (discreteRotateTimer === null) {
    return;
  }
  clearTimeout(discreteRotateTimer);
  discreteRotateTimer = null;
  rotateCooldownActive = false;
  sendMovement("stop");
  renderMovement(currentState);
}

// Used by the onStatus connection-drop path only: mirrors
// clearActiveMovement()'s reasoning — the socket is already gone or about
// to be, so sending Stop here would be a pointless IPC round-trip
// guaranteed to fail. Pure local state reset; render(state) is called by
// the onStatus handler right after this runs.
function clearDiscreteRotateCooldown(): void {
  if (discreteRotateTimer !== null) {
    clearTimeout(discreteRotateTimer);
    discreteRotateTimer = null;
  }
  rotateCooldownActive = false;
}

// Direction sign is a starting assumption per ADR-001, explicitly
// unverified against the physical hardware — see the "Manual test: servo
// direction verified" acceptance criterion. If live testing shows this is
// backwards, this is the one line to flip.
const AIM_ANGLE_DELTA: Record<AimDirection, 1 | -1> = {
  up: 1,
  down: -1,
};

// Computes one step, clamps it to [MIN_AIM_ANGLE, MAX_AIM_ANGLE], updates
// the app-tracked angle, sends it, and re-renders. Returns whether the
// angle actually changed — used to stop the repeat timer once a bound is
// reached, since further ticks in the same direction would be no-ops.
function stepAim(direction: AimDirection): boolean {
  const step = AIM_STEP_DEGREES[aimSpeed] * AIM_ANGLE_DELTA[direction];
  const nextAngle = Math.min(MAX_AIM_ANGLE, Math.max(MIN_AIM_ANGLE, aimAngle + step));
  const changed = nextAngle !== aimAngle;
  aimAngle = nextAngle;
  renderAim(currentState);

  window.carAPI.setAimAngle(aimAngle).catch((error: unknown) => {
    console.error("Set aim angle failed:", error);
  });

  return changed;
}

// pointerdown always interrupts: a new hold overwrites the currently
// tracked direction, mirroring the movement D-pad's interrupt semantics.
// Fires one step immediately (real-time feedback on press), then repeats
// at AIM_REPEAT_INTERVAL_MS while held.
function handleAimPointerDown(direction: AimDirection): void {
  stopActiveAim();
  aimHoldDirection = direction;

  const changed = stepAim(direction);
  if (!changed) {
    // Already at the bound — nothing further to repeat.
    aimHoldDirection = null;
    return;
  }

  aimRepeatTimer = setInterval(() => {
    const stillChanging = stepAim(direction);
    if (!stillChanging) {
      stopActiveAim();
    }
  }, AIM_REPEAT_INTERVAL_MS);
}

// pointerup/pointerleave/pointercancel all funnel through here. Only the
// event whose direction matches the currently-held aimHoldDirection stops
// the repeat timer — a release from a since-superseded button is a no-op,
// matching the movement D-pad's release-matching semantics.
function handleAimRelease(direction: AimDirection): void {
  if (aimHoldDirection !== direction) {
    return;
  }
  stopActiveAim();
}

// Clears the repeat timer and the held-direction tracking. Used by
// pointerup/release, window-blur, and once a bound is reached mid-repeat.
function stopActiveAim(): void {
  if (aimRepeatTimer !== null) {
    clearInterval(aimRepeatTimer);
    aimRepeatTimer = null;
  }
  aimHoldDirection = null;
}

function handleAimSpeedChange(event: Event): void {
  aimSpeed = (event.target as HTMLSelectElement).value as "fast" | "slow";
}

// Direction sign is a starting assumption, explicitly unverified against the
// physical hardware — mirrors AIM_ANGLE_DELTA's same caveat (see this plan's
// CONTEXT.md "unverified direction-sign placeholder" decision). If live
// testing shows this is backwards, this is the one line to flip.
const DISTANCE_SENSOR_ANGLE_DELTA: Record<DistanceSensorDirection, 1 | -1> = {
  left: -1,
  right: 1,
};

// Computes one step, clamps it to [MIN_DISTANCE_SENSOR_ANGLE,
// MAX_DISTANCE_SENSOR_ANGLE], updates the app-tracked angle, sends it, and
// re-renders. Returns whether the angle actually changed — used to stop the
// repeat timer once a bound is reached. Mirrors stepAim().
function stepDistanceSensor(direction: DistanceSensorDirection): boolean {
  const step = DISTANCE_SENSOR_STEP_DEGREES[distanceSensorSpeed] * DISTANCE_SENSOR_ANGLE_DELTA[direction];
  const nextAngle = Math.min(
    MAX_DISTANCE_SENSOR_ANGLE,
    Math.max(MIN_DISTANCE_SENSOR_ANGLE, distanceSensorAngle + step),
  );
  const changed = nextAngle !== distanceSensorAngle;
  distanceSensorAngle = nextAngle;
  renderDistanceSensor(currentState);

  window.carAPI.setDistanceSensorAngle(distanceSensorAngle).catch((error: unknown) => {
    console.error("Set distance sensor angle failed:", error);
  });

  return changed;
}

// pointerdown always interrupts: a new hold overwrites the currently tracked
// direction, mirroring handleAimPointerDown(). Fires one step immediately,
// then repeats at DISTANCE_SENSOR_REPEAT_INTERVAL_MS while held.
function handleDistanceSensorPointerDown(direction: DistanceSensorDirection): void {
  stopActiveDistanceSensor();
  distanceSensorHoldDirection = direction;

  const changed = stepDistanceSensor(direction);
  if (!changed) {
    // Already at the bound — nothing further to repeat.
    distanceSensorHoldDirection = null;
    return;
  }

  distanceSensorRepeatTimer = setInterval(() => {
    const stillChanging = stepDistanceSensor(direction);
    if (!stillChanging) {
      stopActiveDistanceSensor();
    }
  }, DISTANCE_SENSOR_REPEAT_INTERVAL_MS);
}

// pointerup/pointerleave/pointercancel all funnel through here. Only the
// event whose direction matches the currently-held distanceSensorHoldDirection
// stops the repeat timer, mirroring handleAimRelease().
function handleDistanceSensorRelease(direction: DistanceSensorDirection): void {
  if (distanceSensorHoldDirection !== direction) {
    return;
  }
  stopActiveDistanceSensor();
}

// Clears the repeat timer and the held-direction tracking. Mirrors
// stopActiveAim().
function stopActiveDistanceSensor(): void {
  if (distanceSensorRepeatTimer !== null) {
    clearInterval(distanceSensorRepeatTimer);
    distanceSensorRepeatTimer = null;
  }
  distanceSensorHoldDirection = null;
}

function handleDistanceSensorSpeedChange(event: Event): void {
  distanceSensorSpeed = (event.target as HTMLSelectElement).value as "fast" | "slow";
}

render(currentState);
renderWifiLog();
renderUsbLog();
renderUsbLogControls();

document.getElementById("toggle-button")!.addEventListener("click", handleToggleClick);
document.getElementById("wifi-log-clear-button")!.addEventListener("click", handleWifiLogClear);
document.getElementById("usb-log-clear-button")!.addEventListener("click", handleUsbLogClear);
document.getElementById("usb-log-toggle-button")!.addEventListener("click", handleUsbLogToggleClick);
document.getElementById("light-button")!.addEventListener("click", handleLightToggleClick);
document.getElementById("shoot-button")!.addEventListener("click", handleShootClick);
document
  .getElementById("shoot-cooldown-toggle")!
  .addEventListener("change", handleShootCooldownToggleChange);

for (const [direction, id] of Object.entries(MOVEMENT_BUTTON_IDS) as Array<
  [Exclude<MovementDirection, "stop">, string]
>) {
  const button = document.getElementById(id)!;
  button.addEventListener("pointerdown", () => handleMovementPointerDown(direction));
  button.addEventListener("pointerup", () => handleMovementRelease(direction));
  button.addEventListener("pointerleave", () => handleMovementRelease(direction));
  button.addEventListener("pointercancel", () => handleMovementRelease(direction));
}

const AIM_BUTTON_IDS: Record<AimDirection, string> = {
  up: "aim-up-button",
  down: "aim-down-button",
};

for (const [direction, id] of Object.entries(AIM_BUTTON_IDS) as Array<[AimDirection, string]>) {
  const button = document.getElementById(id)!;
  button.addEventListener("pointerdown", () => handleAimPointerDown(direction));
  button.addEventListener("pointerup", () => handleAimRelease(direction));
  button.addEventListener("pointerleave", () => handleAimRelease(direction));
  button.addEventListener("pointercancel", () => handleAimRelease(direction));
}

document.getElementById("aim-speed-select")!.addEventListener("change", handleAimSpeedChange);

const DISTANCE_SENSOR_BUTTON_IDS: Record<DistanceSensorDirection, string> = {
  left: "distance-sensor-left-button",
  right: "distance-sensor-right-button",
};

for (const [direction, id] of Object.entries(DISTANCE_SENSOR_BUTTON_IDS) as Array<
  [DistanceSensorDirection, string]
>) {
  const button = document.getElementById(id)!;
  button.addEventListener("pointerdown", () => handleDistanceSensorPointerDown(direction));
  button.addEventListener("pointerup", () => handleDistanceSensorRelease(direction));
  button.addEventListener("pointerleave", () => handleDistanceSensorRelease(direction));
  button.addEventListener("pointercancel", () => handleDistanceSensorRelease(direction));
}

document
  .getElementById("distance-sensor-speed-select")!
  .addEventListener("change", handleDistanceSensorSpeedChange);

for (const { id, direction, angleDegrees } of DISCRETE_ROTATE_BUTTONS) {
  document
    .getElementById(id)!
    .addEventListener("click", () => handleDiscreteRotate(direction, angleDegrees));
}

window.addEventListener("blur", () => {
  stopActiveMovement();
  stopActiveAim();
  stopActiveDistanceSensor();
  stopActiveDiscreteRotate();
});

window.carAPI.onStatus((state) => {
  // Reset the assumed light state to "off" on every fresh connect/reconnect,
  // disconnect, or error — per spec.md user story 7, so the app never
  // carries over stale on/off state from a previous session. "connecting"
  // is deliberately excluded: it's an in-flight transition, not a settled
  // state boundary.
  if (state.status === "connected" || state.status === "disconnected" || state.status === "error") {
    lightsOn = false;
    // Same reset points as lightsOn, per ADR-001's "App-tracked state"
    // decision: no protocol readback exists for the servo angle either, so
    // the app must not carry over a stale angle assumption across a fresh
    // connect/reconnect, disconnect, or error.
    aimAngle = 90;
    // Same reasoning again for the distance-sensor angle — no protocol
    // readback exists for it either.
    distanceSensorAngle = 90;
  }

  // Movement commands only work over an active tcp100 session — if the
  // connection leaves that state while a direction is held (disconnect,
  // error, or falling back to http80), clear the local tracking rather than
  // leave it pointing at a direction that's no longer reachable. No Stop is
  // sent: the socket is already gone or about to be, per ADR-001.
  if (state.status !== "connected" || state.protocol !== "tcp100") {
    clearActiveMovement();
    // Same reasoning as movement above: aim commands only work over an
    // active tcp100 session, so a held aim button's repeat timer must stop
    // rather than keep firing calls that CarConnection.setAimAngle() would
    // just reject.
    stopActiveAim();
    // Same reasoning again for the distance-sensor control's repeat timer.
    stopActiveDistanceSensor();
    // Same reasoning again: a mid-pulse disconnect must not leave the
    // movement/rotate button set stuck disabled, nor let a stale setTimeout
    // fire a doomed Stop call later once the session is already gone.
    clearDiscreteRotateCooldown();
  }

  currentState = state;
  render(state);
});

// Purely reactive: the badge has no local polling or state of its own — it
// only ever reflects whatever `car:usb-status` last pushed from the main
// process, per ADR-002/this ticket's acceptance criteria.
window.carAPI.onUsbStatus((connected) => {
  renderUsbStatus(connected);
});

// USB Log panel's Connect/Disconnect status, mirroring window.carAPI.onStatus
// above exactly: the module has no local polling of its own — it only ever
// reflects whatever the last "car:usb-log-status" push carried (connected,
// or an error such as "no CH340 adapter found"/a port-open failure), per
// review round-1 fix ticket 02. This also means a mid-stream unplug now
// self-corrects the button/status text on its own, since UsbSerialConnection
// already emits "state-change" for that case — no more waiting for the
// user's next click.
window.carAPI.onUsbLogStatus((state) => {
  usbLogState = state;
  renderUsbLogControls();
});

// Wi-Fi Log panel: appends each pushed batch of lines (already timestamped
// by LogLineBuffer on the main-process side) via the shared append-with-cap
// helper in a single call, then re-renders once per batch — not once per
// line — per review-round-2 fix ticket 01 (car-log-viewer plan): a chunk
// that produced many lines still means exactly one DOM update here. No
// separate control needed — this only ever fires while a tcp100 session is
// live (see carConnection.ts's class doc comment), so it naturally goes
// quiet on disconnect or an http80 session without this handler needing to
// gate on `currentState` itself.
window.carAPI.onWifiLogLines((lines) => {
  wifiLogLines = appendLogLines(wifiLogLines, lines);
  renderWifiLog();
});

// USB Log panel: same append-with-cap/re-render-per-batch shape as
// onWifiLogLines above. Only ever fires while the USB serial port is open
// (see `UsbSerialConnection`'s class doc comment) — no separate gating
// needed here either.
window.carAPI.onUsbLogLines((lines) => {
  usbLogLines = appendLogLines(usbLogLines, lines);
  renderUsbLog();
});
