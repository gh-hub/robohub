/**
 * Plain, Electron-free handler functions for the USB Log Connect/Disconnect
 * IPC channels, plus the log-line forwarding subscription — the USB-serial
 * counterpart to carIpcHandlers.ts's `createCarIpcHandlers`/
 * `forwardConnectionStatus`/`forwardWifiLogLines`, kept in their own module
 * since `UsbSerialConnection` is a wholly separate connection object from
 * `CarConnection` (a different physical transport, no shared lifecycle),
 * per spec.md's "two more new channels handle the USB Log Connect/Disconnect
 * actions ... following the same ... contract already used for the existing
 * Wi-Fi connect/disconnect actions" decision.
 */

import type { UsbSerialState } from "./usbSerialConnection.ts";

/**
 * The subset of `UsbSerialConnection`'s public surface these handlers depend
 * on. A narrow interface (rather than the concrete class) so tests can pass
 * a lightweight fake instead of standing up a real serial-backed instance,
 * mirroring `CarConnectionLike` in carIpcHandlers.ts.
 */
export interface UsbSerialConnectionLike {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getState(): UsbSerialState;
  on(event: "log-lines", listener: (lines: string[]) => void): unknown;
  on(event: "state-change", listener: (state: UsbSerialState) => void): unknown;
  off(event: "log-lines", listener: (lines: string[]) => void): unknown;
  off(event: "state-change", listener: (state: UsbSerialState) => void): unknown;
}

export interface UsbLogIpcHandlers {
  handleUsbLogConnect: () => Promise<void>;
  handleUsbLogDisconnect: () => Promise<void>;
}

/**
 * `handleUsbLogConnect`/`handleUsbLogDisconnect` resolve/reject exactly as
 * `UsbSerialConnection.connect()`/`.disconnect()` themselves do: they resolve
 * once the action has been *initiated*, rejecting only for an invalid
 * current state (e.g. `connect` while already `connecting`) — the same
 * resolve-once-initiated contract `createCarIpcHandlers` uses for the Wi-Fi
 * connect/disconnect channels. Actual connect success/failure is reported
 * separately via `forwardUsbLogStatus()` below, not this promise's
 * resolution.
 */
export function createUsbLogIpcHandlers(connection: UsbSerialConnectionLike): UsbLogIpcHandlers {
  return {
    handleUsbLogConnect: () => connection.connect(),
    handleUsbLogDisconnect: () => connection.disconnect(),
  };
}

/**
 * Subscribes `sendLines` to every future `"log-lines"` event on
 * `connection`. Returns an unsubscribe function. Mirrors
 * `forwardWifiLogLines()` in carIpcHandlers.ts exactly: an adapter wires
 * `sendLines` to `webContents.send(CAR_USB_LOG_LINE_CHANNEL, lines)`, kept
 * as a plain function here so the forwarding logic itself is testable
 * without a real `WebContents`.
 *
 * Forwards the array from a single "log-lines" event as a single IPC send —
 * never splits it back into one send per line — matching
 * `forwardWifiLogLines()`'s batching (review-round-2 fix ticket 01,
 * car-log-viewer plan).
 */
export function forwardUsbLogLines(
  connection: UsbSerialConnectionLike,
  sendLines: (lines: string[]) => void,
): () => void {
  const onLogLines = (lines: string[]): void => {
    sendLines(lines);
  };

  connection.on("log-lines", onLogLines);

  return () => {
    connection.off("log-lines", onLogLines);
  };
}

/**
 * Subscribes `sendStatus` to every future `"state-change"` event on
 * `connection`. Returns an unsubscribe function. Mirrors
 * `forwardConnectionStatus()` in carIpcHandlers.ts exactly: an adapter wires
 * `sendStatus` to `webContents.send(CAR_USB_LOG_STATUS_CHANNEL, state)`, kept
 * as a plain function here so the forwarding logic itself is testable
 * without a real `WebContents`. This is the renderer's real success/failure
 * signal for a `usbLogConnect()` attempt — no CH340 adapter found or a
 * failed port open both land on `status: "error"` here, never a rejection
 * from `handleUsbLogConnect` itself (see that function's doc comment).
 */
export function forwardUsbLogStatus(
  connection: UsbSerialConnectionLike,
  sendStatus: (state: UsbSerialState) => void,
): () => void {
  const onStateChange = (state: UsbSerialState): void => {
    sendStatus(state);
  };

  connection.on("state-change", onStateChange);

  return () => {
    connection.off("state-change", onStateChange);
  };
}
