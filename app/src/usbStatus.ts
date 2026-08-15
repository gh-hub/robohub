import { readdirSync } from "node:fs";

// Per ADR-002
// (.gh-workflows/plans/20260815_083408-water-gun-control/grill/ADR-002.md),
// USB connection status is informational-only: a read-only filesystem check
// for `/dev/cu.usbserial-*` device nodes, macOS-only, with no interaction
// with the device itself (no open, no serial read/write, no vendor/product
// ID query) and no command channel. This module is structurally analogous
// to `forwardConnectionStatus` in carIpcHandlers.ts — a function that takes
// a dependency plus a callback and returns an unsubscribe/stop function —
// but the seam here is poll-based (`checkDevicePresent`) rather than
// event-based, since USB plug/unplug has no OS-level event source available
// without native modules.

export const USB_STATUS_POLL_INTERVAL_MS = 2000;

const USB_SERIAL_DEVICE_PREFIX = "cu.usbserial-";

/**
 * Read-only check for whether any `/dev/cu.usbserial-*` device node exists.
 * Only ever lists directory entries and matches by name prefix — never
 * opens, reads from, or writes to the device node itself, per ADR-002's
 * non-invasive design principle. Returns `false` on any platform other
 * than macOS ("darwin"), and `false` if `deviceDirectory` can't be read for
 * any reason (e.g. missing, permissions) rather than throwing — an
 * unreadable device directory is indistinguishable from "no USB-serial
 * device present" for this informational badge's purposes.
 *
 * `deviceDirectory` defaults to `/dev` (the real macOS device-node
 * directory) but is overridable so tests can point it at a temp directory
 * instead of stubbing `node:fs` itself.
 */
export function isUsbSerialDevicePresent(deviceDirectory: string = "/dev"): boolean {
  if (process.platform !== "darwin") {
    return false;
  }
  try {
    return readdirSync(deviceDirectory).some((name) => name.startsWith(USB_SERIAL_DEVICE_PREFIX));
  } catch {
    return false;
  }
}

/**
 * Polls `checkDevicePresent` every `intervalMs` (default
 * `USB_STATUS_POLL_INTERVAL_MS`, per ADR-002) and calls `onStatusChange`
 * only when the detected presence differs from the last known value — not
 * on every poll tick, per this ticket's "push to IPC on change" acceptance
 * criterion. The first check runs immediately (not after the first
 * interval delay), matching ADR-002's "checks at startup and whenever the
 * poll runs." The assumed starting value is `false` (not present), mirroring
 * the app's existing "no initial-state query" precedent (see preload.ts's
 * `onStatus` doc comment) — so an initially-present device is reported as a
 * change on the first check.
 *
 * Returns a stop function that clears the polling timer; callers unsubscribe
 * with it the same way `forwardConnectionStatus`'s return value is used.
 */
export function startUsbStatusPolling(
  checkDevicePresent: () => boolean,
  onStatusChange: (connected: boolean) => void,
  intervalMs: number = USB_STATUS_POLL_INTERVAL_MS,
): () => void {
  let lastKnownConnected = false;

  const poll = (): void => {
    const connected = checkDevicePresent();
    if (connected !== lastKnownConnected) {
      lastKnownConnected = connected;
      onStatusChange(connected);
    }
  };

  poll();
  const timer = setInterval(poll, intervalMs);

  return () => {
    clearInterval(timer);
  };
}
