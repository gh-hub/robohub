import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";

import { UsbSerialConnection, type SerialPortLike } from "./usbSerialConnection.ts";

const TEST_PORT_PATH = "COM7";

/**
 * In-memory stand-in for a real `serialport`-backed port, per spec.md's
 * "fake, in-memory implementation standing in for the real `serialport`-
 * backed one" testing decision — never touches real hardware or the native
 * binding. Auto-fires `"open"` on the next microtask by default (mirroring
 * real `serialport`'s "opens in the next tick" autoOpen behavior); pass
 * `{ openError }` to simulate a failed open instead.
 */
class FakeSerialPort extends EventEmitter implements SerialPortLike {
  closeCallCount = 0;

  constructor(openError?: Error) {
    super();
    queueMicrotask(() => {
      if (openError) {
        this.emit("error", openError);
      } else {
        this.emit("open");
      }
    });
  }

  close(): void {
    this.closeCallCount += 1;
    queueMicrotask(() => this.emit("close"));
  }

  /** Simulates the device being unplugged mid-stream: a `"close"` event
   * carrying an error, per `serialport`'s documented Disconnect Error
   * behavior — distinct from this fake's own `close()` method above, which
   * simulates a clean, user-initiated close. */
  simulateUnexpectedClose(err: Error): void {
    this.emit("close", err);
  }
}

interface TestHarness {
  connection: UsbSerialConnection;
  createdPorts: FakeSerialPort[];
  openOptionsCalls: Array<{ path: string; baudRate: number }>;
}

function makeConnection(
  options: {
    findPortPath?: () => Promise<string | null>;
    nextOpenError?: Error;
  } = {},
): TestHarness {
  const createdPorts: FakeSerialPort[] = [];
  const openOptionsCalls: Array<{ path: string; baudRate: number }> = [];

  const connection = new UsbSerialConnection({
    findPortPath: options.findPortPath ?? (async () => TEST_PORT_PATH),
    openSerialPort: (openOptions) => {
      openOptionsCalls.push(openOptions);
      const port = new FakeSerialPort(options.nextOpenError);
      createdPorts.push(port);
      return port;
    },
  });

  return { connection, createdPorts, openOptionsCalls };
}

test("connect() opens the auto-detected CH340 port at 115200 baud", async () => {
  const { connection, openOptionsCalls } = makeConnection();

  await connection.connect();

  assert.deepEqual(openOptionsCalls, [{ path: TEST_PORT_PATH, baudRate: 115200 }]);
  assert.deepEqual(connection.getState(), {
    status: "connected",
    message: `Connected to ${TEST_PORT_PATH} at 115200 baud`,
  });
});

test("connect() resolves (not rejects) when no CH340 adapter is found, without opening any port", async () => {
  const { connection, openOptionsCalls } = makeConnection({ findPortPath: async () => null });

  await connection.connect();

  assert.deepEqual(openOptionsCalls, []);
  assert.deepEqual(connection.getState(), {
    status: "error",
    message: "No CH340 serial adapter detected.",
  });
});

test("connect() resolves (not rejects) when the found port fails to open", async () => {
  const openError = new Error("Access denied");
  const { connection } = makeConnection({ nextOpenError: openError });

  await connection.connect();

  assert.deepEqual(connection.getState(), {
    status: "error",
    message: "Failed to open COM7: Access denied",
  });
});

test('a failed connect() emits "state-change" with the error, matching CarConnection.connect()\'s always-resolves contract', async () => {
  const { connection } = makeConnection({ findPortPath: async () => null });

  const states: Array<{ status: string; message: string | null }> = [];
  connection.on("state-change", (state) => states.push(state));

  await connection.connect();

  assert.deepEqual(states, [
    { status: "connecting", message: null },
    { status: "error", message: "No CH340 serial adapter detected." },
  ]);
});

test("connect() rejects synchronously when a connection attempt is already in flight", async () => {
  const { connection } = makeConnection();

  const firstAttempt = connection.connect();
  await assert.rejects(() => connection.connect(), /status is "connecting"/);
  await firstAttempt;
});

test("connect() rejects synchronously when already connected", async () => {
  const { connection } = makeConnection();
  await connection.connect();

  await assert.rejects(() => connection.connect(), /status is "connected"/);
});

test("disconnect() rejects when not connected", async () => {
  const { connection } = makeConnection();

  await assert.rejects(() => connection.disconnect(), /status is "disconnected"/);
});

test("disconnect() while connected cleanly closes the port and transitions to disconnected", async () => {
  const { connection, createdPorts } = makeConnection();
  await connection.connect();

  await connection.disconnect();

  assert.equal(createdPorts[0].closeCallCount, 1);
  assert.deepEqual(connection.getState(), { status: "disconnected", message: null });
});

test("multiple connect/disconnect cycles work without error", async () => {
  const { connection, createdPorts } = makeConnection();

  await connection.connect();
  await connection.disconnect();
  await connection.connect();
  await connection.disconnect();

  assert.equal(createdPorts.length, 2);
  assert.deepEqual(connection.getState(), { status: "disconnected", message: null });
});

test("a connected session emits one \"log-lines\" batch carrying every line from a chunk", async () => {
  const { connection, createdPorts } = makeConnection();
  await connection.connect();

  const receivedBatches: string[][] = [];
  connection.on("log-lines", (lines: string[]) => receivedBatches.push(lines));

  createdPorts[0].emit("data", Buffer.from("first line\nsecond line\n"));

  assert.equal(receivedBatches.length, 1, "both lines arrive in a single event, not one per line");
  assert.equal(receivedBatches[0].length, 2);
  assert.match(receivedBatches[0][0], /^\[\d{2}:\d{2}:\d{2}\.\d{3}\] first line$/);
  assert.match(receivedBatches[0][1], /^\[\d{2}:\d{2}:\d{2}\.\d{3}\] second line$/);
});

test("a trailing partial line (no newline) is not emitted", async () => {
  const { connection, createdPorts } = makeConnection();
  await connection.connect();

  const receivedLines: string[] = [];
  connection.on("log-lines", (lines: string[]) => receivedLines.push(...lines));

  createdPorts[0].emit("data", Buffer.from("complete\npartial-no-newline"));

  assert.equal(receivedLines.length, 1);
  assert.match(receivedLines[0], /complete$/);
});

// Per review-round-2 fix ticket 01 (car-log-viewer plan): a malfunctioning
// or malicious USB-serial peer sending a chunk that's mostly newline bytes
// can make a single LogLineBuffer.push() call return tens of thousands of
// lines. This proves that still results in exactly one "log-lines" event
// carrying the entire array, not one event per line.
test('a chunk producing thousands of lines still emits exactly one "log-lines" event carrying all of them', async () => {
  const { connection, createdPorts } = makeConnection();
  await connection.connect();

  const receivedBatches: string[][] = [];
  connection.on("log-lines", (lines: string[]) => receivedBatches.push(lines));

  const LINE_COUNT = 20000;
  createdPorts[0].emit("data", Buffer.from("\n".repeat(LINE_COUNT)));

  assert.equal(receivedBatches.length, 1, "one chunk must yield exactly one event, not one per line");
  assert.equal(receivedBatches[0].length, LINE_COUNT);
});

test("a fresh reconnect starts with no carried-over partial-line state from the previous session", async () => {
  const { connection, createdPorts } = makeConnection();
  await connection.connect();
  createdPorts[0].emit("data", Buffer.from("partial-no-newline-from-session-one"));
  await connection.disconnect();

  await connection.connect();
  const receivedLines: string[] = [];
  connection.on("log-lines", (lines: string[]) => receivedLines.push(...lines));
  createdPorts[1].emit("data", Buffer.from("session two complete\n"));

  assert.deepEqual(
    receivedLines.map((line) => line.replace(/^\[[^\]]+\]\s*/, "")),
    ["session two complete"],
  );
});

test("device unplugged mid-stream (an unexpected close) transitions to error and clears the port reference", async () => {
  const { connection, createdPorts } = makeConnection();
  await connection.connect();

  createdPorts[0].simulateUnexpectedClose(new Error("device disconnected"));

  const state = connection.getState();
  assert.equal(state.status, "error");
  assert.match(state.message ?? "", /closed unexpectedly/);
});

test("after an unplug-triggered error, connect() can succeed again (state is no longer stuck)", async () => {
  const { connection, createdPorts } = makeConnection();
  await connection.connect();
  createdPorts[0].simulateUnexpectedClose(new Error("device disconnected"));
  assert.equal(connection.getState().status, "error");

  await connection.connect();

  assert.equal(connection.getState().status, "connected");
  assert.equal(createdPorts.length, 2);
});

test("a port error event closes the port, clears the reference, and transitions to error without crashing the process", async () => {
  const { connection, createdPorts } = makeConnection();
  await connection.connect();

  createdPorts[0].emit("error", new Error("write failed"));

  const state = connection.getState();
  assert.equal(state.status, "error");
  assert.match(state.message ?? "", /Serial port error: write failed/);
  assert.equal(createdPorts[0].closeCallCount, 1, "the errored port is closed best-effort, not left open");
});

test("after a port error event, connect() succeeds cleanly with no leftover port handle", async () => {
  const { connection, createdPorts } = makeConnection();
  await connection.connect();

  createdPorts[0].emit("error", new Error("write failed"));
  assert.equal(createdPorts[0].closeCallCount, 1);

  await connection.connect();

  assert.equal(connection.getState().status, "connected");
  assert.equal(createdPorts.length, 2, "a fresh port was opened, not reusing the errored one");
});

test("a delayed close from an errored port does not clobber a subsequently opened port's state", async () => {
  const { connection, createdPorts } = makeConnection();
  await connection.connect();

  createdPorts[0].emit("error", new Error("write failed"));
  await connection.connect();
  assert.equal(connection.getState().status, "connected");

  // Let the errored port's queued "close" microtask (from its own close()
  // call above) actually fire — it must be a no-op now that this instance
  // has moved on to a different port.
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(connection.getState().status, "connected");
});
