import { EventEmitter } from "node:events";

import { SerialPort } from "serialport";

import { findCh340PortPath } from "./ch340Port.ts";
import { LogLineBuffer } from "./logLineBuffer.ts";

export type UsbSerialStatus = "disconnected" | "connecting" | "connected" | "error";

export interface UsbSerialState {
  status: UsbSerialStatus;
  message: string | null;
}

const DISCONNECTED_STATE: UsbSerialState = { status: "disconnected", message: null };

// Fixed per spec.md ("A user-configurable baud rate" is explicitly Out of
// Scope) — not exposed as a constructor option, unlike `findPortPath`/
// `openSerialPort` below, which exist purely for test injection.
const USB_SERIAL_BAUD_RATE = 115200;

/**
 * The subset of a `serialport`-backed open port this module actually uses.
 * Narrow (rather than importing `SerialPort` itself) so tests can inject a
 * fake in-memory implementation instead of exercising real hardware or the
 * native `serialport` binding, per spec.md's USB-serial-module testing
 * decision — mirrors `CarConnectionLike`'s "inject a narrow interface"
 * precedent in carIpcHandlers.ts.
 */
export interface SerialPortLike {
  once(event: "open", listener: () => void): unknown;
  once(event: "error", listener: (err: Error) => void): unknown;
  once(event: "close", listener: () => void): unknown;
  on(event: "data", listener: (chunk: Buffer) => void): unknown;
  on(event: "close", listener: (err?: Error) => void): unknown;
  on(event: "error", listener: (err: Error) => void): unknown;
  close(): void;
}

export type OpenSerialPort = (options: { path: string; baudRate: number }) => SerialPortLike;

export interface UsbSerialConnectionOptions {
  /** Defaults to opening a real `serialport`-backed `SerialPort`. Overridable
   * so tests never touch the native binding or real hardware. */
  openSerialPort?: OpenSerialPort;
  /** Defaults to the shared `findCh340PortPath()` helper (ch340Port.ts).
   * Overridable so tests can inject a fixed path or a "not found" (`null`)
   * result without touching `SerialPort.list()`. */
  findPortPath?: () => Promise<string | null>;
}

function openRealSerialPort(options: { path: string; baudRate: number }): SerialPortLike {
  return new SerialPort({ path: options.path, baudRate: options.baudRate });
}

/**
 * Owns opening, reading from, and closing the car's CH340 USB serial port
 * for the USB Log panel, per spec.md's "A new module owns opening, reading
 * from, and closing the physical USB serial port" decision. Structured the
 * same way `CarConnection` (carConnection.ts) is: framework-free (no
 * Electron dependency), constructed with injectable dependencies, and
 * exposes connect()/disconnect() with the exact same "resolves once
 * initiated, rejects synchronously only for an invalid current state"
 * contract established there — see the class's own tests for the exact
 * contract.
 *
 * Actual connect success/failure (no CH340 adapter found, the found port
 * failing to open) is reported asynchronously via the inherited
 * `"state-change"` event (see `setState()`), the same way
 * `CarConnection.connect()` relies on its own `"state-change"` event —
 * `usbLogIpcHandlers.ts`'s `forwardUsbLogStatus()` is what forwards this
 * over IPC to the renderer, mirroring `carIpcHandlers.ts`'s
 * `forwardConnectionStatus()` exactly.
 *
 * Reuses `LogLineBuffer` (the same buffering/newline-splitting/timestamping
 * logic the Wi-Fi tcp100 path uses in carConnection.ts) rather than a second
 * copy of it, per spec.md.
 *
 * Like `CarConnection`, emits a "log-lines" event carrying every complete
 * line a single `data` chunk produced, batched per chunk rather than one
 * event per line — see `CarConnection`'s class doc comment for the
 * resource-exhaustion DoS this avoids (review-round-2 fix ticket 01,
 * car-log-viewer plan); the same reasoning applies here for a malfunctioning
 * or malicious USB-serial peer.
 */
export class UsbSerialConnection extends EventEmitter {
  private readonly openSerialPort: OpenSerialPort;
  private readonly findPortPath: () => Promise<string | null>;

  private state: UsbSerialState = { ...DISCONNECTED_STATE };
  // Invariant: non-null exactly while a session's port is actually open and
  // this instance still owns it. Every path that leaves "connected" (a clean
  // disconnect(), an unplug-triggered close, or the "error" listener below)
  // clears this before or as part of the same state transition — so
  // `main.ts`'s before-quit cleanup only ever needs to check for
  // `status === "connected"` (see its own comment); there is no reachable
  // state with a live port and a non-"connected" status.
  private port: SerialPortLike | null = null;

  constructor(options: UsbSerialConnectionOptions = {}) {
    super();
    this.openSerialPort = options.openSerialPort ?? openRealSerialPort;
    this.findPortPath = options.findPortPath ?? (() => findCh340PortPath());
  }

  getState(): UsbSerialState {
    return this.state;
  }

  /**
   * Auto-detects the car's CH340 port (via `findPortPath`) and opens it at
   * `USB_SERIAL_BAUD_RATE`. Rejects synchronously (before any I/O) if a
   * connection attempt is already in flight or already connected. Otherwise
   * always resolves once the attempt has been initiated — matching
   * `CarConnection.connect()`'s contract exactly — whether or not the
   * attempt ultimately succeeds; the `"state-change"` event (see
   * `setState()`) is the real source of truth for success/failure (no CH340
   * adapter found, or the found port failing to open both land on
   * `status: "error"` there, never a rejection here).
   */
  async connect(): Promise<void> {
    if (this.state.status === "connecting" || this.state.status === "connected") {
      throw new Error(`connect() called while status is "${this.state.status}"`);
    }

    this.setState({ status: "connecting", message: null });

    const path = await this.findPortPath();
    if (path === null) {
      this.setState({ status: "error", message: "No CH340 serial adapter detected." });
      return;
    }

    try {
      const port = await this.openPort(path);
      this.port = port;
      this.attachSessionListeners(port);
      this.setState({
        status: "connected",
        message: `Connected to ${path} at ${USB_SERIAL_BAUD_RATE} baud`,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.setState({ status: "error", message: `Failed to open ${path}: ${reason}` });
    }
  }

  /**
   * Cleanly closes the open port. Rejects synchronously if not currently
   * connected. Resolves once the port's own `"close"` event has fired (see
   * `attachSessionListeners`), which is also what actually performs the
   * state transition and clears `this.port` — a single source of truth
   * shared with the unplugged-mid-stream path, so there is never a
   * duplicate/conflicting state update between a user-initiated disconnect
   * and a device-initiated one.
   */
  async disconnect(): Promise<void> {
    if (this.state.status !== "connected") {
      throw new Error(`disconnect() called while status is "${this.state.status}"`);
    }

    const port = this.port;
    await new Promise<void>((resolve) => {
      port?.once("close", () => resolve());
      port?.close();
    });
  }

  /**
   * Opens `path` at the fixed baud rate via the injectable
   * `openSerialPort`, resolving once the port reports `"open"` or rejecting
   * once it reports `"error"` before ever opening (e.g. the port doesn't
   * exist, is already exclusively locked by another tool, etc.).
   */
  private openPort(path: string): Promise<SerialPortLike> {
    return new Promise((resolve, reject) => {
      const port = this.openSerialPort({ path, baudRate: USB_SERIAL_BAUD_RATE });
      port.once("open", () => resolve(port));
      port.once("error", (err: Error) => reject(err));
    });
  }

  /**
   * Wires the three events a live, open port can raise. A fresh
   * `LogLineBuffer` per successful open means a later reconnect starts with
   * no carried-over partial-line state from a previous session, matching
   * `CarConnection.probeTcpAndHold()`'s identical reasoning for the tcp100
   * socket. The "data" listener re-emits every completed line from a chunk
   * as one "log-lines" event (see the class doc comment), never one event
   * per line.
   */
  private attachSessionListeners(port: SerialPortLike): void {
    const logLineBuffer = new LogLineBuffer();
    port.on("data", (chunk: Buffer) => {
      const lines = logLineBuffer.push(chunk);
      if (lines.length > 0) {
        this.emit("log-lines", lines);
      }
    });

    // The device being unplugged mid-stream reaches this same listener (see
    // "Port errors are handled gracefully" acceptance criterion): `serialport`
    // reports that case as a "close" event carrying a Disconnect Error object
    // rather than a separate unrecoverable state, so a present `err` here
    // means an abrupt/unexpected drop, not the clean user-initiated
    // disconnect() path (which closes with no `err`). The `this.port !==
    // port` guard discards a "close" event from a port this instance has
    // already moved on from — e.g. the best-effort `close()` the "error"
    // listener below triggers can settle after a later `connect()` has
    // already opened a new port; without the guard, that stale event would
    // null out the new port's reference or clobber its state.
    port.on("close", (err?: Error) => {
      if (this.port !== port) {
        return;
      }
      this.handlePortClose(err);
    });

    // A live port can also raise "error" outside of closing (e.g. a failed
    // write) without necessarily closing itself. Per spec.md's "no lingering
    // lock" guarantee (user story 7), this must not leave the OS-level
    // handle open with no remaining code path to close it: close the port
    // best-effort (a close failure here isn't actionable — state already
    // reflects the error, and the guard above ignores the resulting stale
    // "close") and clear `this.port` immediately/synchronously, so a
    // subsequent connect() never races the port's own possibly-delayed
    // "close" event and always starts from a clean slate. This listener also
    // prevents an unhandled "error" event from crashing the process (Node's
    // EventEmitter throws if "error" has no listener), mirroring
    // `CarConnection`'s `handleSocketError`.
    port.on("error", (err: Error) => {
      if (this.port !== port) {
        return;
      }
      this.setState({ status: "error", message: `Serial port error: ${err.message}` });
      this.port = null;
      try {
        port.close();
      } catch {
        // Best-effort: the state above already reflects the error; nothing
        // more to do if closing an already-broken port also fails.
      }
    });
  }

  private handlePortClose(err?: Error): void {
    this.port = null;
    if (err) {
      this.setState({ status: "error", message: `Serial port closed unexpectedly: ${err.message}` });
    } else {
      this.setState({ ...DISCONNECTED_STATE });
    }
  }

  private setState(next: UsbSerialState): void {
    this.state = next;
    this.emit("state-change", next);
  }
}
