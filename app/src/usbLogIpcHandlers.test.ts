import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";

import {
  createUsbLogIpcHandlers,
  forwardUsbLogLines,
  forwardUsbLogStatus,
  type UsbSerialConnectionLike,
} from "./usbLogIpcHandlers.ts";
import type { UsbSerialState } from "./usbSerialConnection.ts";

const DISCONNECTED_STATE: UsbSerialState = { status: "disconnected", message: null };
const CONNECTED_STATE: UsbSerialState = { status: "connected", message: "Connected to COM7 at 115200 baud" };

/**
 * Minimal stand-in for `UsbSerialConnection`, mirroring
 * carIpcHandlers.test.ts's `FakeCarConnection` — verifies the handlers call
 * the right methods and forward the right values without any real serial
 * I/O.
 */
class FakeUsbSerialConnection extends EventEmitter implements UsbSerialConnectionLike {
  connectCallCount = 0;
  disconnectCallCount = 0;

  private state: UsbSerialState;
  private readonly connectImpl: () => Promise<void>;
  private readonly disconnectImpl: () => Promise<void>;

  constructor(
    options: {
      initialState?: UsbSerialState;
      onConnect?: () => Promise<void>;
      onDisconnect?: () => Promise<void>;
    } = {},
  ) {
    super();
    this.state = options.initialState ?? { ...DISCONNECTED_STATE };
    this.connectImpl = options.onConnect ?? (async () => this.setState(CONNECTED_STATE));
    this.disconnectImpl = options.onDisconnect ?? (async () => this.setState(DISCONNECTED_STATE));
  }

  getState(): UsbSerialState {
    return this.state;
  }

  async connect(): Promise<void> {
    this.connectCallCount += 1;
    await this.connectImpl();
  }

  async disconnect(): Promise<void> {
    this.disconnectCallCount += 1;
    await this.disconnectImpl();
  }

  setState(next: UsbSerialState): void {
    this.state = next;
    this.emit("state-change", next);
  }
}

test("handleUsbLogConnect calls connection.connect() exactly once", async () => {
  const connection = new FakeUsbSerialConnection();
  const handlers = createUsbLogIpcHandlers(connection);

  await handlers.handleUsbLogConnect();

  assert.equal(connection.connectCallCount, 1);
});

test("handleUsbLogConnect rejects when connection.connect() rejects (e.g. an invalid current state)", async () => {
  const connection = new FakeUsbSerialConnection({
    onConnect: async () => {
      throw new Error('connect() called while status is "connecting"');
    },
  });
  const handlers = createUsbLogIpcHandlers(connection);

  await assert.rejects(() => handlers.handleUsbLogConnect(), /status is "connecting"/);
});

test("handleUsbLogDisconnect calls connection.disconnect() exactly once", async () => {
  const connection = new FakeUsbSerialConnection({ initialState: CONNECTED_STATE });
  const handlers = createUsbLogIpcHandlers(connection);

  await handlers.handleUsbLogDisconnect();

  assert.equal(connection.disconnectCallCount, 1);
});

test("handleUsbLogDisconnect rejects when connection.disconnect() rejects", async () => {
  const connection = new FakeUsbSerialConnection({
    onDisconnect: async () => {
      throw new Error('disconnect() called while status is "disconnected"');
    },
  });
  const handlers = createUsbLogIpcHandlers(connection);

  await assert.rejects(() => handlers.handleUsbLogDisconnect(), /disconnected/);
});

test('forwardUsbLogLines forwards every "log-lines" batch as a single call', () => {
  const connection = new FakeUsbSerialConnection();
  const received: string[][] = [];

  forwardUsbLogLines(connection, (lines) => {
    received.push(lines);
  });

  connection.emit("log-lines", ["[00:00:00.000] first", "[00:00:00.001] second"]);
  connection.emit("log-lines", ["[00:00:00.002] third"]);

  assert.deepEqual(received, [
    ["[00:00:00.000] first", "[00:00:00.001] second"],
    ["[00:00:00.002] third"],
  ]);
});

test("forwardUsbLogLines's unsubscribe stops further forwarding", () => {
  const connection = new FakeUsbSerialConnection();
  const received: string[][] = [];

  const unsubscribe = forwardUsbLogLines(connection, (lines) => {
    received.push(lines);
  });
  unsubscribe();

  connection.emit("log-lines", ["[00:00:00.000] should not arrive"]);

  assert.deepEqual(received, []);
});

test('forwardUsbLogStatus forwards every "state-change" event', () => {
  const connection = new FakeUsbSerialConnection();
  const received: UsbSerialState[] = [];

  forwardUsbLogStatus(connection, (state) => {
    received.push(state);
  });

  connection.setState({ status: "connecting", message: null });
  connection.setState({ status: "error", message: "No CH340 serial adapter detected." });

  assert.deepEqual(received, [
    { status: "connecting", message: null },
    { status: "error", message: "No CH340 serial adapter detected." },
  ]);
});

test("forwardUsbLogStatus's unsubscribe stops further forwarding", () => {
  const connection = new FakeUsbSerialConnection();
  const received: UsbSerialState[] = [];

  const unsubscribe = forwardUsbLogStatus(connection, (state) => {
    received.push(state);
  });
  unsubscribe();

  connection.setState(CONNECTED_STATE);

  assert.deepEqual(received, []);
});
