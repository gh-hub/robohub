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
 * Both "Left Light" and "Right Light" buttons render from this same result
 * (mirrored — the protocol has one shared LED command, so there is no
 * independent left/right state to diverge). Enabled only for an active
 * tcp100 session; disabled in every other case (disconnected, connecting,
 * error, or connected over the http80 fallback, which has no LED support).
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
