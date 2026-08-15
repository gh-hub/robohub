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
