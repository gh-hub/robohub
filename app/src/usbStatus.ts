import { SerialPort } from "serialport";

import { isCh340Port, type SerialPortIdentity } from "./ch340Port.ts";

// Per ADR-001 (.gh-workflows/plans/20260815_160434-car-log-viewer/grill/ADR-001.md),
// which supersedes ADR-002's macOS-only, filesystem-based check, this module
// now enumerates ports cross-platform via `serialport`'s `SerialPort.list()`.
// It remains structurally analogous to `forwardConnectionStatus` in
// carIpcHandlers.ts — a function that takes a dependency plus a callback and
// returns an unsubscribe/stop function — with the same poll-based seam
// (`checkDevicePresent`) as before, since USB plug/unplug still has no OS-level
// event source available without deeper native-module integration than this
// badge needs. Presence detection stays enumeration-only: it never opens the
// matched port, so it never contends with the USB Log Connect action (see
// usbSerialConnection.ts) for exclusive access to the device.
//
// `isCh340Port`/`SerialPortIdentity` moved to ch340Port.ts once the USB Log
// Connect action became a second consumer of the same VID/PID matching rule
// (re-exported here so existing importers of this module keep working).

export const USB_STATUS_POLL_INTERVAL_MS = 2000;

export { isCh340Port, type SerialPortIdentity };

/**
 * Read-only check for whether a CH340 serial adapter is currently enumerated
 * by the OS, on any platform `serialport` supports (Windows and macOS, per
 * this plan's scope). Only ever lists ports — never opens, reads from, or
 * writes to the matched device, per ADR-001's "enumeration-only" badge
 * contract. Returns `false` (rather than throwing) if the underlying list
 * call fails for any reason (e.g. no native binding available), matching the
 * previous "unreadable is indistinguishable from absent" behavior.
 *
 * `listPorts` defaults to the real `SerialPort.list()` but is overridable so
 * tests can inject a fake port list instead of touching the real native
 * binding or an actual OS device.
 */
export async function isUsbSerialDevicePresent(
  listPorts: () => Promise<SerialPortIdentity[]> = () => SerialPort.list(),
): Promise<boolean> {
  try {
    const ports = await listPorts();
    return ports.some(isCh340Port);
  } catch {
    return false;
  }
}

/**
 * Polls `checkDevicePresent` every `intervalMs` (default
 * `USB_STATUS_POLL_INTERVAL_MS`) and calls `onStatusChange` only when the
 * detected presence differs from the last known value — not on every poll
 * tick, per this ticket's "push to IPC on change" acceptance criterion. The
 * first check runs immediately (not after the first interval delay). The
 * assumed starting value is `false` (not present), mirroring the app's
 * existing "no initial-state query" precedent (see preload.ts's `onStatus`
 * doc comment) — so an initially-present device is reported as a change on
 * the first check.
 *
 * `checkDevicePresent` may return a plain `boolean` or a `Promise<boolean>`.
 * A plain boolean is handled synchronously within the same poll tick (this
 * keeps this function's own tests, which inject simple sync fakes, exercising
 * genuinely synchronous behavior); a promise is awaited before comparing
 * against the last known value. Production code (`isUsbSerialDevicePresent`,
 * backed by `serialport`'s inherently async `SerialPort.list()`) uses the
 * async path.
 *
 * Returns a stop function that clears the polling timer; callers unsubscribe
 * with it the same way `forwardConnectionStatus`'s return value is used.
 */
export function startUsbStatusPolling(
  checkDevicePresent: () => boolean | Promise<boolean>,
  onStatusChange: (connected: boolean) => void,
  intervalMs: number = USB_STATUS_POLL_INTERVAL_MS,
): () => void {
  let lastKnownConnected = false;

  const handleResult = (connected: boolean): void => {
    if (connected !== lastKnownConnected) {
      lastKnownConnected = connected;
      onStatusChange(connected);
    }
  };

  const poll = (): void => {
    const result = checkDevicePresent();
    if (result instanceof Promise) {
      result.then(handleResult);
    } else {
      handleResult(result);
    }
  };

  poll();
  const timer = setInterval(poll, intervalMs);

  return () => {
    clearInterval(timer);
  };
}
