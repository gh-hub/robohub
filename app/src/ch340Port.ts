import { SerialPort } from "serialport";

// Shared VID/PID auto-detect helper, per spec.md's "A shared VID/PID
// auto-detect helper wraps serialport's port-listing call" decision
// (car-log-viewer plan). Both the USB presence badge (usbStatus.ts) and the
// USB Log Connect action (usbSerialConnection.ts) use this one module, so
// the CH340 matching rule and the "find the port's path" lookup each live in
// exactly one place. Framework-free (no Electron import) so it's directly
// unit-testable and reusable from the main process, mirroring
// commandFrame.ts's/carConnection.ts's existing "pure/injectable, no
// Electron import" precedent.
//
// Extracted out of usbStatus.ts (where it originated in ticket 01) once a
// second consumer (this ticket's USB Log Connect action) actually needed it,
// per the "no over-engineering" coding rule.

const CH340_VENDOR_ID = "1a86";
const CH340_PRODUCT_ID = "7523";

/**
 * The subset of `serialport`'s `PortInfo` this module actually reads. Kept
 * narrow (rather than importing `PortInfo` itself) so tests can inject plain
 * fake port objects without depending on `serialport`'s full shape. `path`
 * is `serialport`'s own guaranteed-present field (see `PortInfo`'s doc
 * comment) — every other field may be `undefined` if the OS/driver doesn't
 * report it.
 */
export interface SerialPortIdentity {
  path: string;
  vendorId: string | undefined;
  productId: string | undefined;
}

function normalizeHexId(id: string): string {
  return id.toLowerCase().replace(/^0x/, "");
}

/**
 * True when `port`'s vendor/product ID matches the documented CH340 chip
 * identity (0x1A86/0x7523). `serialport` reports these as lowercase hex with
 * no `0x` prefix, but this normalizes both sides so callers can compare
 * against either form.
 */
export function isCh340Port(port: SerialPortIdentity): boolean {
  return (
    port.vendorId !== undefined &&
    port.productId !== undefined &&
    normalizeHexId(port.vendorId) === CH340_VENDOR_ID &&
    normalizeHexId(port.productId) === CH340_PRODUCT_ID
  );
}

/**
 * Lists ports via `listPorts` (defaulting to the real `SerialPort.list()`)
 * and returns the path of the first CH340-matching port, or `null` if none
 * is found. Only ever lists — never opens, reads from, or writes to any
 * port, so it's safe to call from both the passive presence badge and the
 * USB Log Connect action without either contending with the other for
 * exclusive device access.
 *
 * `listPorts` is overridable so tests can inject a fake port list instead of
 * touching the real native binding or an actual OS device.
 */
export async function findCh340PortPath(
  listPorts: () => Promise<SerialPortIdentity[]> = () => SerialPort.list(),
): Promise<string | null> {
  const ports = await listPorts();
  const match = ports.find(isCh340Port);
  return match?.path ?? null;
}
