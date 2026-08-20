import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "node:path";

import { CarConnection } from "./carConnection.ts";
import { createCarIpcHandlers, forwardConnectionStatus, forwardWifiLogLines } from "./carIpcHandlers.ts";
import type { MovementDirection } from "./commandFrame.ts";
import {
  CAR_CONNECT_CHANNEL,
  CAR_DISCONNECT_CHANNEL,
  CAR_SET_LIGHTS_CHANNEL,
  CAR_SET_MOVEMENT_CHANNEL,
  CAR_SET_PAN_ANGLE_CHANNEL,
  CAR_SHOOT_CHANNEL,
  CAR_STATUS_CHANNEL,
  CAR_USB_LOG_CONNECT_CHANNEL,
  CAR_USB_LOG_DISCONNECT_CHANNEL,
  CAR_USB_LOG_LINE_CHANNEL,
  CAR_USB_LOG_STATUS_CHANNEL,
  CAR_USB_STATUS_CHANNEL,
  CAR_WIFI_LOG_LINE_CHANNEL,
} from "./ipcChannels.ts";
import { createUsbLogIpcHandlers, forwardUsbLogLines, forwardUsbLogStatus } from "./usbLogIpcHandlers.ts";
import { UsbSerialConnection } from "./usbSerialConnection.ts";
import { isUsbSerialDevicePresent, startUsbStatusPolling } from "./usbStatus.ts";

// Single, app-lifetime connection instance — per ADR-002, the main process
// is the sole owner of the car's TCP socket. `new CarConnection()` (no
// options) uses the real carConfig constants (production host/ports), as
// opposed to the overrides carConnection.test.ts uses to avoid privileged
// ports in tests.
const carConnection = new CarConnection();
const carIpcHandlers = createCarIpcHandlers(carConnection);

ipcMain.handle(CAR_CONNECT_CHANNEL, () => carIpcHandlers.handleConnect());
ipcMain.handle(CAR_DISCONNECT_CHANNEL, () => carIpcHandlers.handleDisconnect());
ipcMain.handle(CAR_SET_LIGHTS_CHANNEL, (_event, on: boolean) => carIpcHandlers.handleSetLights(on));
ipcMain.handle(CAR_SET_MOVEMENT_CHANNEL, (_event, direction: MovementDirection) =>
  carIpcHandlers.handleSetMovement(direction),
);
ipcMain.handle(CAR_SHOOT_CHANNEL, () => carIpcHandlers.handleShoot());
ipcMain.handle(CAR_SET_PAN_ANGLE_CHANNEL, (_event, angle: number) =>
  carIpcHandlers.handleSetPanAngle(angle),
);

// Single, app-lifetime USB-serial connection instance for the USB Log panel
// — separate from carConnection above (a different physical transport, no
// shared lifecycle), per usbSerialConnection.ts's class doc comment.
// `new UsbSerialConnection()` (no options) opens a real `serialport`-backed
// port auto-detected via the real `SerialPort.list()`, as opposed to the
// fakes usbSerialConnection.test.ts injects.
const usbSerialConnection = new UsbSerialConnection();
const usbLogIpcHandlers = createUsbLogIpcHandlers(usbSerialConnection);

ipcMain.handle(CAR_USB_LOG_CONNECT_CHANNEL, () => usbLogIpcHandlers.handleUsbLogConnect());
ipcMain.handle(CAR_USB_LOG_DISCONNECT_CHANNEL, () => usbLogIpcHandlers.handleUsbLogDisconnect());

// Closing the app must not leave the USB serial port locked for other tools
// (Arduino IDE, esptool.py, etc.) — per spec.md's Connect/Disconnect
// rationale. Only meaningful while actually connected: `disconnect()`
// rejects synchronously otherwise, and there's nothing to await here since
// the process is exiting regardless of whether the close completes in time.
// Checking only for "connected" (not also "error") is deliberate, not a
// gap: per `UsbSerialConnection`'s own port-field invariant (see its class
// body), every non-"connected" status — "error" included — is only ever
// reached with `this.port` already cleared, since the port's own "error"
// listener now closes the port and nulls the reference itself. So there is
// no reachable "error"-with-a-live-handle state left for this handler to
// account for.
app.on("before-quit", () => {
  if (usbSerialConnection.getState().status === "connected") {
    void usbSerialConnection.disconnect();
  }
});

function createWindow(): void {
  const window = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // Electron's default sandboxed preload environment (sandbox left
      // unset, i.e. true) is used here — preload.ts is self-contained (no
      // local require()/import of other app/src/ files at runtime; see its
      // header comment), so it runs fine under the default sandbox. Do not
      // add local imports/requires to preload.ts without re-verifying this.
    },
  });

  // Forward every future state change to this window's renderer. Unsubscribe
  // on close so a destroyed window's webContents is never sent to (which
  // would throw) once the window goes away.
  const stopForwardingStatus = forwardConnectionStatus(carConnection, (state) => {
    window.webContents.send(CAR_STATUS_CHANNEL, state);
  });

  // USB status badge, per ADR-002: an independent, polled, informational
  // signal unrelated to the Wi-Fi/TCP connection lifecycle above — it does
  // not share carConnection or CAR_STATUS_CHANNEL. Same unsubscribe-on-close
  // discipline as stopForwardingStatus.
  const stopUsbStatusPolling = startUsbStatusPolling(isUsbSerialDevicePresent, (connected) => {
    window.webContents.send(CAR_USB_STATUS_CHANNEL, connected);
  });

  // Wi-Fi Log panel, per spec.md: forwards every "log-lines" event
  // carConnection emits (tcp100 sessions only) to this window's renderer —
  // one IPC send per emitted batch, not per line (see forwardWifiLogLines's
  // doc comment). Same unsubscribe-on-close discipline as stopForwardingStatus.
  const stopForwardingWifiLogLines = forwardWifiLogLines(carConnection, (lines) => {
    window.webContents.send(CAR_WIFI_LOG_LINE_CHANNEL, lines);
  });

  // USB Log panel, per spec.md: forwards every "log-lines" event
  // usbSerialConnection emits (only while a port is actually open) to this
  // window's renderer — one IPC send per emitted batch, not per line. Same
  // unsubscribe-on-close discipline as the other forwarders above.
  const stopForwardingUsbLogLines = forwardUsbLogLines(usbSerialConnection, (lines) => {
    window.webContents.send(CAR_USB_LOG_LINE_CHANNEL, lines);
  });

  // USB Log Connect/Disconnect status push, mirroring stopForwardingStatus
  // above: forwards every "state-change" usbSerialConnection emits (connect
  // success/failure, a clean disconnect, or an unplug-triggered drop) so the
  // renderer's USB Log toggle button/status text has a real signal to render
  // from, per review round-1 fix ticket 02. Same unsubscribe-on-close
  // discipline as the other forwarders above.
  const stopForwardingUsbLogStatus = forwardUsbLogStatus(usbSerialConnection, (state) => {
    window.webContents.send(CAR_USB_LOG_STATUS_CHANNEL, state);
  });

  window.on("closed", () => {
    stopForwardingStatus();
    stopUsbStatusPolling();
    stopForwardingWifiLogLines();
    stopForwardingUsbLogLines();
    stopForwardingUsbLogStatus();
  });

  window.loadFile(path.join(__dirname, "..", "public", "index.html"));
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
