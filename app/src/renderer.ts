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
  type ConnectionState,
} from "./connectionUiState.ts";

interface CarApi {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  onStatus: (callback: (state: ConnectionState) => void) => () => void;
  setLights: (on: boolean) => Promise<void>;
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

// Mirrored on/off state for both light buttons — one shared boolean, not two
// independent ones, since the wire protocol has a single LED command with
// no independent left/right addressing (see spec.md). App-tracked/optimistic
// only: the protocol has no state-readback channel, so this never reflects
// a query of the hardware, only what the app last told it to do.
let lightsOn = false;

function render(state: ConnectionState): void {
  const button = document.getElementById("toggle-button") as HTMLButtonElement;
  const statusText = document.getElementById("status-text") as HTMLElement;
  const uiState = mapConnectionStatusToUiState(state);

  button.textContent = uiState.buttonLabel;
  button.disabled = uiState.buttonDisabled;
  statusText.textContent = uiState.statusText;
  statusText.className = uiState.statusClass;

  renderLights(state);
}

function renderLights(state: ConnectionState): void {
  const leftButton = document.getElementById("light-left-button") as HTMLButtonElement;
  const rightButton = document.getElementById("light-right-button") as HTMLButtonElement;
  const lightUiState = mapLightControlUiState(state, lightsOn);

  leftButton.textContent = `Left Light: ${lightUiState.stateLabel}`;
  leftButton.disabled = lightUiState.disabled;
  rightButton.textContent = `Right Light: ${lightUiState.stateLabel}`;
  rightButton.disabled = lightUiState.disabled;
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

render(currentState);

document.getElementById("toggle-button")!.addEventListener("click", handleToggleClick);
document.getElementById("light-left-button")!.addEventListener("click", handleLightToggleClick);
document.getElementById("light-right-button")!.addEventListener("click", handleLightToggleClick);

window.carAPI.onStatus((state) => {
  // Reset the assumed light state to "off" on every fresh connect/reconnect,
  // disconnect, or error — per spec.md user story 7, so the app never
  // carries over stale on/off state from a previous session. "connecting"
  // is deliberately excluded: it's an in-flight transition, not a settled
  // state boundary.
  if (state.status === "connected" || state.status === "disconnected" || state.status === "error") {
    lightsOn = false;
  }
  currentState = state;
  render(state);
});
