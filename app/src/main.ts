import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "node:path";

import { CarConnection } from "./carConnection.ts";
import { createCarIpcHandlers, forwardConnectionStatus } from "./carIpcHandlers.ts";
import type { MovementDirection } from "./commandFrame.ts";
import {
  CAR_CONNECT_CHANNEL,
  CAR_DISCONNECT_CHANNEL,
  CAR_SET_LIGHTS_CHANNEL,
  CAR_SET_MOVEMENT_CHANNEL,
  CAR_SET_PAN_ANGLE_CHANNEL,
  CAR_SHOOT_CHANNEL,
  CAR_STATUS_CHANNEL,
  CAR_USB_STATUS_CHANNEL,
} from "./ipcChannels.ts";
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

  window.on("closed", () => {
    stopForwardingStatus();
    stopUsbStatusPolling();
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
