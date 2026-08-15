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
  mapConnectionStatusToUiState,
  mapLightControlUiState,
  mapMovementControlUiState,
  type ConnectionState,
} from "./connectionUiState.ts";

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
}

function renderLights(state: ConnectionState): void {
  const lightButton = document.getElementById("light-button") as HTMLButtonElement;
  const lightUiState = mapLightControlUiState(state, lightsOn);

  lightButton.textContent = `Lights: ${lightUiState.stateLabel}`;
  lightButton.disabled = lightUiState.disabled;
}

function renderMovement(state: ConnectionState): void {
  const movementUiState = mapMovementControlUiState(state);

  for (const id of Object.values(MOVEMENT_BUTTON_IDS)) {
    (document.getElementById(id) as HTMLButtonElement).disabled = movementUiState.disabled;
  }
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

render(currentState);

document.getElementById("toggle-button")!.addEventListener("click", handleToggleClick);
document.getElementById("light-button")!.addEventListener("click", handleLightToggleClick);

for (const [direction, id] of Object.entries(MOVEMENT_BUTTON_IDS) as Array<
  [Exclude<MovementDirection, "stop">, string]
>) {
  const button = document.getElementById(id)!;
  button.addEventListener("pointerdown", () => handleMovementPointerDown(direction));
  button.addEventListener("pointerup", () => handleMovementRelease(direction));
  button.addEventListener("pointerleave", () => handleMovementRelease(direction));
  button.addEventListener("pointercancel", () => handleMovementRelease(direction));
}

window.addEventListener("blur", stopActiveMovement);

window.carAPI.onStatus((state) => {
  // Reset the assumed light state to "off" on every fresh connect/reconnect,
  // disconnect, or error — per spec.md user story 7, so the app never
  // carries over stale on/off state from a previous session. "connecting"
  // is deliberately excluded: it's an in-flight transition, not a settled
  // state boundary.
  if (state.status === "connected" || state.status === "disconnected" || state.status === "error") {
    lightsOn = false;
  }

  // Movement commands only work over an active tcp100 session — if the
  // connection leaves that state while a direction is held (disconnect,
  // error, or falling back to http80), clear the local tracking rather than
  // leave it pointing at a direction that's no longer reachable. No Stop is
  // sent: the socket is already gone or about to be, per ADR-001.
  if (state.status !== "connected" || state.protocol !== "tcp100") {
    clearActiveMovement();
  }

  currentState = state;
  render(state);
});
