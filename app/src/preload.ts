// Preload script, runs in an isolated context with access to a limited set
// of Node/Electron APIs before the renderer's web content loads.
//
// Exposes the car connection's IPC surface to the renderer via
// contextBridge.exposeInMainWorld. Per ADR-002, the renderer never gets
// ipcRenderer, Node APIs, or raw sockets directly — only this narrow,
// declared `window.carAPI`.
//
// This file must have zero local require()/import calls to other files in
// app/src/ — Electron's default sandboxed preload environment can't resolve
// local relative requires (only Electron/Node built-ins), so a local
// `require()` here would silently fail to expose window.carAPI. The channel
// name constants below are therefore inlined (copied from ipcChannels.ts)
// rather than imported; keep them in sync by hand if ipcChannels.ts changes.
// `import type` for ConnectionState is safe since type-only imports are
// erased at compile time and never become a runtime require().

import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

import type { ConnectionState } from "./carConnection.ts";
import type { MovementDirection } from "./commandFrame.ts";

const CAR_CONNECT_CHANNEL = "car:connect";
const CAR_DISCONNECT_CHANNEL = "car:disconnect";
const CAR_STATUS_CHANNEL = "car:status";
const CAR_SET_LIGHTS_CHANNEL = "car:set-lights";
const CAR_SET_MOVEMENT_CHANNEL = "car:set-movement";

export interface CarApi {
  /** Initiates a connection attempt. Resolves once initiated; rejects if a
   * connection is already in progress or established. The resulting status
   * arrives via `onStatus`, not this call's resolution — see
   * carIpcHandlers.ts for why. */
  connect: () => Promise<void>;
  /** Initiates a disconnect. Resolves once initiated; rejects if not
   * currently connected. The resulting status arrives via `onStatus`. */
  disconnect: () => Promise<void>;
  /** Subscribes to every connection status push. Returns an unsubscribe
   * function. There is no initial-state query — a fresh connection starts
   * `disconnected`, so callers can assume that until the first push. */
  onStatus: (callback: (state: ConnectionState) => void) => () => void;
  /** Sends the shared LED on/off command. Resolves once the frame has been
   * written to the socket; rejects (without writing) if there's no active
   * tcp100 session — see `CarConnection.setLedState()`/`sendCommandFrame()`
   * for the exact rejection contract. The single Lights button invokes this
   * call, since the wire protocol has one shared LED command (no
   * independent left/right addressing). */
  setLights: (on: boolean) => Promise<void>;
  /** Sends a movement command frame for the given direction. Resolves once
   * the frame has been written to the socket; rejects (without writing) if
   * there's no active tcp100 session — see `CarConnection.setMovement()`/
   * `sendCommandFrame()` for the exact rejection contract. Includes
   * `"stop"`: the renderer calls this with `"stop"` on pointerup/
   * pointerleave/pointercancel/window-blur, not just with the six movement
   * directions on pointerdown. */
  setMovement: (direction: MovementDirection) => Promise<void>;
}

declare global {
  interface Window {
    carAPI: CarApi;
  }
}

const carAPI: CarApi = {
  connect: () => ipcRenderer.invoke(CAR_CONNECT_CHANNEL),
  disconnect: () => ipcRenderer.invoke(CAR_DISCONNECT_CHANNEL),
  setLights: (on) => ipcRenderer.invoke(CAR_SET_LIGHTS_CHANNEL, on),
  setMovement: (direction) => ipcRenderer.invoke(CAR_SET_MOVEMENT_CHANNEL, direction),
  onStatus: (callback) => {
    const listener = (_event: IpcRendererEvent, state: ConnectionState): void => callback(state);
    ipcRenderer.on(CAR_STATUS_CHANNEL, listener);
    return () => {
      ipcRenderer.removeListener(CAR_STATUS_CHANNEL, listener);
    };
  },
};

contextBridge.exposeInMainWorld("carAPI", carAPI);
