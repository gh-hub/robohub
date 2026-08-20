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
import type { UsbSerialState } from "./usbSerialConnection.ts";

const CAR_CONNECT_CHANNEL = "car:connect";
const CAR_DISCONNECT_CHANNEL = "car:disconnect";
const CAR_STATUS_CHANNEL = "car:status";
const CAR_SET_LIGHTS_CHANNEL = "car:set-lights";
const CAR_SET_MOVEMENT_CHANNEL = "car:set-movement";
const CAR_SHOOT_CHANNEL = "car:shoot";
const CAR_SET_PAN_ANGLE_CHANNEL = "car:set-pan-angle";
const CAR_USB_STATUS_CHANNEL = "car:usb-status";
const CAR_WIFI_LOG_LINE_CHANNEL = "car:wifi-log-line";
const CAR_USB_LOG_CONNECT_CHANNEL = "car:usb-log-connect";
const CAR_USB_LOG_DISCONNECT_CHANNEL = "car:usb-log-disconnect";
const CAR_USB_LOG_LINE_CHANNEL = "car:usb-log-line";
const CAR_USB_LOG_STATUS_CHANNEL = "car:usb-log-status";

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
  /** Fires a single shoot pulse. Resolves once the frame has been written
   * to the socket; rejects (without writing) if there's no active tcp100
   * session — see `CarConnection.shoot()`/`sendCommandFrame()` for the
   * exact rejection contract. Takes no arguments: the firmware ignores the
   * value byte for this device (see ADR-001). */
  shoot: () => Promise<void>;
  /** Sends an absolute pan-servo angle command frame. Resolves once the
   * frame has been written to the socket; rejects (without writing) if
   * there's no active tcp100 session — see `CarConnection.setPanAngle()`/
   * `sendCommandFrame()` for the exact rejection contract. `angle` must be
   * an integer in [1, 180]; the main-process handler validates this at the
   * IPC trust boundary and rejects otherwise (see ADR-001). */
  setPanAngle: (angle: number) => Promise<void>;
  /** Subscribes to every USB-serial status push. Returns an unsubscribe
   * function. Per ADR-002, this is informational-only — there is no
   * initial-state query, so callers should assume "not connected" until
   * the first push, mirroring `onStatus`'s precedent. */
  onUsbStatus: (callback: (connected: boolean) => void) => () => void;
  /** Subscribes to every Wi-Fi log-lines batch pushed from the tcp100
   * session's "log-lines" events (see `CarConnection`'s class doc comment).
   * Each callback invocation carries every complete line produced by one
   * socket `data` chunk (one call per chunk, not one per line — see
   * review-round-2 fix ticket 01, car-log-viewer plan). Returns an
   * unsubscribe function, mirroring `onStatus`/`onUsbStatus`. Never fires for
   * an http80 session or while disconnected — that's expected, not an error
   * path, per spec.md. */
  onWifiLogLines: (callback: (lines: string[]) => void) => () => void;
  /** Initiates opening the auto-detected CH340 USB serial port for the USB
   * Log panel. Resolves once initiated, exactly like `connect()` above — the
   * resulting status (connected, or an error such as "no CH340 adapter
   * found"/a port-open failure) arrives via `onUsbLogStatus`, not this
   * call's resolution. Rejects synchronously only if a connect attempt is
   * already in flight or already connected. */
  usbLogConnect: () => Promise<void>;
  /** Cleanly closes the open USB serial port. Resolves once initiated;
   * rejects synchronously if not currently connected. The resulting status
   * arrives via `onUsbLogStatus`. */
  usbLogDisconnect: () => Promise<void>;
  /** Subscribes to every USB Log connection status push. Returns an
   * unsubscribe function, mirroring `onStatus`. There is no initial-state
   * query — a fresh `UsbSerialConnection` starts `"disconnected"`, so
   * callers can assume that until the first push. This is the renderer's
   * real signal for whether a `usbLogConnect()` attempt succeeded or failed
   * (e.g. no CH340 adapter detected, or the found port failing to open). */
  onUsbLogStatus: (callback: (state: UsbSerialState) => void) => () => void;
  /** Subscribes to every USB log-lines batch pushed while the USB serial
   * port is open (see `UsbSerialConnection`'s class doc comment). Each
   * callback invocation carries every complete line produced by one port
   * `data` chunk, mirroring `onWifiLogLines`'s batching exactly. Returns an
   * unsubscribe function. Never fires before a successful `usbLogConnect()`
   * or after `usbLogDisconnect()`/an unplug. */
  onUsbLogLines: (callback: (lines: string[]) => void) => () => void;
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
  shoot: () => ipcRenderer.invoke(CAR_SHOOT_CHANNEL),
  setPanAngle: (angle) => ipcRenderer.invoke(CAR_SET_PAN_ANGLE_CHANNEL, angle),
  onStatus: (callback) => {
    const listener = (_event: IpcRendererEvent, state: ConnectionState): void => callback(state);
    ipcRenderer.on(CAR_STATUS_CHANNEL, listener);
    return () => {
      ipcRenderer.removeListener(CAR_STATUS_CHANNEL, listener);
    };
  },
  onUsbStatus: (callback) => {
    const listener = (_event: IpcRendererEvent, connected: boolean): void => callback(connected);
    ipcRenderer.on(CAR_USB_STATUS_CHANNEL, listener);
    return () => {
      ipcRenderer.removeListener(CAR_USB_STATUS_CHANNEL, listener);
    };
  },
  onWifiLogLines: (callback) => {
    const listener = (_event: IpcRendererEvent, lines: string[]): void => callback(lines);
    ipcRenderer.on(CAR_WIFI_LOG_LINE_CHANNEL, listener);
    return () => {
      ipcRenderer.removeListener(CAR_WIFI_LOG_LINE_CHANNEL, listener);
    };
  },
  usbLogConnect: () => ipcRenderer.invoke(CAR_USB_LOG_CONNECT_CHANNEL),
  usbLogDisconnect: () => ipcRenderer.invoke(CAR_USB_LOG_DISCONNECT_CHANNEL),
  onUsbLogStatus: (callback) => {
    const listener = (_event: IpcRendererEvent, state: UsbSerialState): void => callback(state);
    ipcRenderer.on(CAR_USB_LOG_STATUS_CHANNEL, listener);
    return () => {
      ipcRenderer.removeListener(CAR_USB_LOG_STATUS_CHANNEL, listener);
    };
  },
  onUsbLogLines: (callback) => {
    const listener = (_event: IpcRendererEvent, lines: string[]): void => callback(lines);
    ipcRenderer.on(CAR_USB_LOG_LINE_CHANNEL, listener);
    return () => {
      ipcRenderer.removeListener(CAR_USB_LOG_LINE_CHANNEL, listener);
    };
  },
};

contextBridge.exposeInMainWorld("carAPI", carAPI);
