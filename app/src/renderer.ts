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
import { mapConnectionStatusToUiState, type ConnectionState } from "./connectionUiState.ts";

interface CarApi {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  onStatus: (callback: (state: ConnectionState) => void) => () => void;
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

function render(state: ConnectionState): void {
  const button = document.getElementById("toggle-button") as HTMLButtonElement;
  const statusText = document.getElementById("status-text") as HTMLElement;
  const uiState = mapConnectionStatusToUiState(state);

  button.textContent = uiState.buttonLabel;
  button.disabled = uiState.buttonDisabled;
  statusText.textContent = uiState.statusText;
  statusText.className = uiState.statusClass;
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

render(currentState);

document.getElementById("toggle-button")!.addEventListener("click", handleToggleClick);

window.carAPI.onStatus((state) => {
  currentState = state;
  render(state);
});
