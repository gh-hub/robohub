// Renderer-side files (this one and renderer.ts) compile to native ES
// modules via tsconfig.renderer.json so they can be loaded with a plain
// `<script type="module">` tag in the actual browser-world renderer, with
// zero Node access, per ADR-002. carConnection.ts stays CommonJS (Electron's
// main process loads it via require()). Importing its types here — even as
// `import type` — would still pull carConnection.ts's full runtime module
// into this ES-module compilation unit, and tsc would then emit a
// clobbering ESM copy of dist/carConnection.js over the CommonJS one
// main.ts/preload.ts/carIpcHandlers.ts need (discovered by an actual
// Electron launch throwing `SyntaxError: Cannot use import statement
// outside a module` from dist/carConnection.js). So this shape is
// redeclared locally instead; keep it in sync with carConnection.ts's
// `ConnectionState`.
export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";
export type CarProtocol = "tcp100" | "http80";
export interface ConnectionState {
  status: ConnectionStatus;
  protocol: CarProtocol | null;
  message: string | null;
}

export interface ConnectionUiState {
  buttonLabel: "Connect" | "Connecting…" | "Disconnect";
  buttonDisabled: boolean;
  statusText: string;
  statusClass: "status-disconnected" | "status-connecting" | "status-connected" | "status-error";
}

/**
 * Pure `ConnectionStatus` (+ message/protocol) -> UI state mapping. No DOM
 * access, so it's directly unit-testable as input/output pairs, per
 * spec.md's "renderer status-to-UI mapping" testing decision.
 */
export function mapConnectionStatusToUiState(state: ConnectionState): ConnectionUiState {
  switch (state.status) {
    case "disconnected":
      return {
        buttonLabel: "Connect",
        buttonDisabled: false,
        statusText: "Disconnected",
        statusClass: "status-disconnected",
      };
    case "connecting":
      return {
        buttonLabel: "Connecting…",
        buttonDisabled: true,
        statusText: "Connecting…",
        statusClass: "status-connecting",
      };
    case "connected":
      return {
        buttonLabel: "Disconnect",
        buttonDisabled: false,
        statusText: state.message ?? "Connected",
        statusClass: "status-connected",
      };
    case "error":
      // Button stays enabled (not disabled) so the user can retry
      // immediately after fixing the underlying issue — per spec.md user
      // story 8.
      return {
        buttonLabel: "Connect",
        buttonDisabled: false,
        statusText: state.message ?? "Connection error",
        statusClass: "status-error",
      };
  }
}

export interface LightControlUiState {
  disabled: boolean;
  stateLabel: "On" | "Off";
}

/**
 * Pure `ConnectionState` + local lights-on boolean -> light-button UI state
 * mapping, per spec.md's "renderer status-to-UI mapping" testing decision.
 * The single Lights button renders from this result — the protocol has one
 * shared LED command, so there is no independent left/right state to track.
 * Enabled only for an active tcp100 session; disabled in every other case
 * (disconnected, connecting, error, or connected over the http80 fallback,
 * which has no LED support).
 */
export function mapLightControlUiState(
  connection: ConnectionState,
  lightsOn: boolean,
): LightControlUiState {
  return {
    disabled: connection.status !== "connected" || connection.protocol !== "tcp100",
    stateLabel: lightsOn ? "On" : "Off",
  };
}

export interface MovementControlUiState {
  disabled: boolean;
}

/**
 * Pure `ConnectionState` -> D-pad button UI state mapping, same gate as
 * `mapLightControlUiState` (per grill/decisions.md's "reuse gating rule
 * from lights" decision). Unlike lights, movement has no persistent
 * on/off label to carry — each button is momentary (press-and-hold), so
 * there's nothing to mirror beyond enabled/disabled.
 */
export function mapMovementControlUiState(connection: ConnectionState): MovementControlUiState {
  return {
    disabled: connection.status !== "connected" || connection.protocol !== "tcp100",
  };
}

export interface ShootControlUiState {
  disabled: boolean;
}

/**
 * Pure `ConnectionState` -> Shoot button UI state mapping, same gate as
 * `mapLightControlUiState`/`mapMovementControlUiState` (per ADR-001's
 * "Gating and enablement" decision — Shoot reuses the exact same
 * `connected && tcp100` predicate, no new gating logic). The cooldown
 * toggle's own disable window is a separate, DOM-timer-driven concern
 * layered on top by the renderer — deliberately not part of this pure,
 * connection-state-only mapping.
 */
export function mapShootControlUiState(connection: ConnectionState): ShootControlUiState {
  return {
    disabled: connection.status !== "connected" || connection.protocol !== "tcp100",
  };
}

// Firmware-supported servo range, per ADR-001 at
// .gh-workflows/plans/20260815_083408-water-gun-control/grill/ADR-001.md.
const MIN_AIM_ANGLE = 1;
const MAX_AIM_ANGLE = 180;

// Redeclared locally for the same reason `ConnectionState` is above: this
// file compiles into the ES-module renderer build, but the real
// `UsbSerialState`/`UsbSerialStatus` types live in usbSerialConnection.ts, a
// CommonJS main-process file. Keep in sync with that file's types by hand.
export type UsbLogStatus = "disconnected" | "connecting" | "connected" | "error";
export interface UsbLogState {
  status: UsbLogStatus;
  message: string | null;
}

export interface UsbLogControlUiState {
  buttonLabel: "Connect" | "Connecting…" | "Disconnect";
  buttonDisabled: boolean;
  statusText: string;
  statusClass:
    | "usb-log-status-disconnected"
    | "usb-log-status-connecting"
    | "usb-log-status-connected"
    | "usb-log-status-error";
}

/**
 * Pure `UsbLogStatus` (+ message) -> USB Log toggle button/status-text UI
 * state mapping, mirroring `mapConnectionStatusToUiState()` above exactly —
 * per review round-1 fix ticket 02, the USB Log Connect button now renders
 * from a real status push (`onUsbLogStatus`) instead of the app-tracked
 * boolean it used before, so a failed Connect attempt (no CH340 detected, a
 * port-open error) has a visible statusText for the operator instead of only
 * a console.error.
 */
export function mapUsbLogControlUiState(state: UsbLogState): UsbLogControlUiState {
  switch (state.status) {
    case "disconnected":
      return {
        buttonLabel: "Connect",
        buttonDisabled: false,
        statusText: "Not connected",
        statusClass: "usb-log-status-disconnected",
      };
    case "connecting":
      return {
        buttonLabel: "Connecting…",
        buttonDisabled: true,
        statusText: "Connecting…",
        statusClass: "usb-log-status-connecting",
      };
    case "connected":
      return {
        buttonLabel: "Disconnect",
        buttonDisabled: false,
        statusText: state.message ?? "Connected",
        statusClass: "usb-log-status-connected",
      };
    case "error":
      // Button stays enabled (not disabled) so the user can retry
      // immediately after fixing the underlying issue, mirroring
      // mapConnectionStatusToUiState()'s identical "error" case.
      return {
        buttonLabel: "Connect",
        buttonDisabled: false,
        statusText: state.message ?? "USB Log connection error",
        statusClass: "usb-log-status-error",
      };
  }
}

export interface AimControlUiState {
  upDisabled: boolean;
  downDisabled: boolean;
}

/**
 * Pure `ConnectionState` + current angle -> Up/Down button UI state
 * mapping, per ADR-001's "Gating and enablement" decision — Aim reuses the
 * same `connected && tcp100` predicate as lights/movement/shoot, combined
 * with the angle-bound edge cases at 1 and 180 (per ADR-001's "Bounds"
 * decision: Up disabled at angle >= 180, Down disabled at angle <= 1).
 * Either condition alone is enough to disable a button. The speed-dropdown
 * selection and the press-and-hold repeat timer are separate,
 * DOM-timer-driven concerns layered on top by the renderer — deliberately
 * not part of this pure, connection-state-and-angle-only mapping.
 */
export function mapAimControlUiState(connection: ConnectionState, angle: number): AimControlUiState {
  const connectionDisabled = connection.status !== "connected" || connection.protocol !== "tcp100";
  return {
    upDisabled: connectionDisabled || angle >= MAX_AIM_ANGLE,
    downDisabled: connectionDisabled || angle <= MIN_AIM_ANGLE,
  };
}

// Bounds for the distance-sensor servo, per
// .gh-workflows/plans/20260820_115614-distance-servo-pan-control/ —
// deliberately mirrors MIN_AIM_ANGLE/MAX_AIM_ANGLE's full 1-180 range for
// consistency, even though the firmware (once it gains a handler for this
// device code) is expected to only use a narrower internal sub-range.
const MIN_DISTANCE_SENSOR_ANGLE = 1;
const MAX_DISTANCE_SENSOR_ANGLE = 180;

export interface DistanceSensorControlUiState {
  leftDisabled: boolean;
  rightDisabled: boolean;
}

/**
 * Pure `ConnectionState` + current angle -> Left/Right button UI state
 * mapping for the distance sensor's pan servo, mirroring
 * `mapAimControlUiState()` exactly (see
 * .gh-workflows/plans/20260820_115614-distance-servo-pan-control/) — same
 * `connected && tcp100` gating predicate, combined with the angle-bound edge
 * cases at 1 and 180 (`leftDisabled` at angle <= 1, `rightDisabled` at angle
 * >= 180). Either condition alone is enough to disable a button. The
 * speed-dropdown selection and the press-and-hold repeat timer are separate,
 * DOM-timer-driven concerns layered on top by the renderer — deliberately
 * not part of this pure, connection-state-and-angle-only mapping.
 */
export function mapDistanceSensorControlUiState(
  connection: ConnectionState,
  angle: number,
): DistanceSensorControlUiState {
  const connectionDisabled = connection.status !== "connected" || connection.protocol !== "tcp100";
  return {
    leftDisabled: connectionDisabled || angle <= MIN_DISTANCE_SENSOR_ANGLE,
    rightDisabled: connectionDisabled || angle >= MAX_DISTANCE_SENSOR_ANGLE,
  };
}
