import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import * as net from "node:net";
import { test } from "node:test";

import { CarConnection, type ConnectionState } from "./carConnection.ts";
import type { MovementDirection } from "./commandFrame.ts";
import {
  createCarIpcHandlers,
  forwardConnectionStatus,
  forwardWifiLogLines,
  type CarConnectionLike,
} from "./carIpcHandlers.ts";

const CONNECTED_STATE: ConnectionState = {
  status: "connected",
  protocol: "tcp100",
  message: "Connected to 192.168.4.1:100 (TCP)",
};

const DISCONNECTED_STATE: ConnectionState = {
  status: "disconnected",
  protocol: null,
  message: null,
};

/**
 * Minimal stand-in for `CarConnection` used to verify the handlers call the
 * right methods and forward the right values, without any real socket I/O.
 * Per spec.md's IPC-contract testing decision, the handlers are written
 * against `CarConnectionLike` specifically so a fake like this is enough.
 */
class FakeCarConnection extends EventEmitter implements CarConnectionLike {
  connectCallCount = 0;
  disconnectCallCount = 0;
  setLedStateCalls: boolean[] = [];
  setMovementCalls: MovementDirection[] = [];
  shootCallCount = 0;
  setAimAngleCalls: number[] = [];
  setDistanceSensorAngleCalls: number[] = [];

  private state: ConnectionState;
  private readonly connectImpl: () => Promise<void>;
  private readonly disconnectImpl: () => Promise<void>;
  private readonly setLedStateImpl: (on: boolean) => Promise<void>;
  private readonly setMovementImpl: (direction: MovementDirection) => Promise<void>;
  private readonly shootImpl: () => Promise<void>;
  private readonly setAimAngleImpl: (angle: number) => Promise<void>;
  private readonly setDistanceSensorAngleImpl: (angle: number) => Promise<void>;

  constructor(options: {
    initialState?: ConnectionState;
    onConnect?: () => Promise<void>;
    onDisconnect?: () => Promise<void>;
    onSetLedState?: (on: boolean) => Promise<void>;
    onSetMovement?: (direction: MovementDirection) => Promise<void>;
    onShoot?: () => Promise<void>;
    onSetAimAngle?: (angle: number) => Promise<void>;
    onSetDistanceSensorAngle?: (angle: number) => Promise<void>;
  } = {}) {
    super();
    this.state = options.initialState ?? { ...DISCONNECTED_STATE };
    this.connectImpl = options.onConnect ?? (async () => this.setState(CONNECTED_STATE));
    this.disconnectImpl = options.onDisconnect ?? (async () => this.setState(DISCONNECTED_STATE));
    this.setLedStateImpl = options.onSetLedState ?? (async () => {});
    this.setMovementImpl = options.onSetMovement ?? (async () => {});
    this.shootImpl = options.onShoot ?? (async () => {});
    this.setAimAngleImpl = options.onSetAimAngle ?? (async () => {});
    this.setDistanceSensorAngleImpl = options.onSetDistanceSensorAngle ?? (async () => {});
  }

  getState(): ConnectionState {
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

  async setLedState(on: boolean): Promise<void> {
    this.setLedStateCalls.push(on);
    await this.setLedStateImpl(on);
  }

  async setMovement(direction: MovementDirection): Promise<void> {
    this.setMovementCalls.push(direction);
    await this.setMovementImpl(direction);
  }

  async shoot(): Promise<void> {
    this.shootCallCount += 1;
    await this.shootImpl();
  }

  async setAimAngle(angle: number): Promise<void> {
    this.setAimAngleCalls.push(angle);
    await this.setAimAngleImpl(angle);
  }

  async setDistanceSensorAngle(angle: number): Promise<void> {
    this.setDistanceSensorAngleCalls.push(angle);
    await this.setDistanceSensorAngleImpl(angle);
  }

  setState(next: ConnectionState): void {
    this.state = next;
    this.emit("state-change", next);
  }
}

test("handleConnect calls connection.connect() exactly once", async () => {
  const connection = new FakeCarConnection();
  const handlers = createCarIpcHandlers(connection);

  await handlers.handleConnect();

  assert.equal(connection.connectCallCount, 1);
});

test("handleConnect rejects when connection.connect() rejects", async () => {
  const connection = new FakeCarConnection({
    onConnect: async () => {
      throw new Error('connect() called while status is "connecting"');
    },
  });
  const handlers = createCarIpcHandlers(connection);

  await assert.rejects(() => handlers.handleConnect(), /connecting/);
});

test("handleDisconnect calls connection.disconnect() exactly once", async () => {
  const connection = new FakeCarConnection({ initialState: CONNECTED_STATE });
  const handlers = createCarIpcHandlers(connection);

  await handlers.handleDisconnect();

  assert.equal(connection.disconnectCallCount, 1);
});

test("handleDisconnect rejects when connection.disconnect() rejects", async () => {
  const connection = new FakeCarConnection({
    onDisconnect: async () => {
      throw new Error('disconnect() called while status is "disconnected"');
    },
  });
  const handlers = createCarIpcHandlers(connection);

  await assert.rejects(() => handlers.handleDisconnect(), /disconnected/);
});

test("handleSetLights calls connection.setLedState(true) when turning lights on", async () => {
  const connection = new FakeCarConnection({ initialState: CONNECTED_STATE });
  const handlers = createCarIpcHandlers(connection);

  await handlers.handleSetLights(true);

  assert.deepEqual(connection.setLedStateCalls, [true]);
});

test("handleSetLights calls connection.setLedState(false) when turning lights off", async () => {
  const connection = new FakeCarConnection({ initialState: CONNECTED_STATE });
  const handlers = createCarIpcHandlers(connection);

  await handlers.handleSetLights(false);

  assert.deepEqual(connection.setLedStateCalls, [false]);
});

test("handleSetLights rejects when connection.setLedState() rejects", async () => {
  const connection = new FakeCarConnection({
    onSetLedState: async () => {
      throw new Error('sendCommandFrame() called while status is "disconnected" and protocol is "null"');
    },
  });
  const handlers = createCarIpcHandlers(connection);

  await assert.rejects(() => handlers.handleSetLights(true), /sendCommandFrame/);
});

const MOVEMENT_DIRECTIONS: MovementDirection[] = [
  "stop",
  "forward",
  "backward",
  "left",
  "right",
  "rotate-left",
  "rotate-right",
];

for (const direction of MOVEMENT_DIRECTIONS) {
  test(`handleSetMovement calls connection.setMovement("${direction}")`, async () => {
    const connection = new FakeCarConnection({ initialState: CONNECTED_STATE });
    const handlers = createCarIpcHandlers(connection);

    await handlers.handleSetMovement(direction);

    assert.deepEqual(connection.setMovementCalls, [direction]);
  });
}

test("handleSetMovement rejects an invalid direction string without reaching connection.setMovement()", async () => {
  const connection = new FakeCarConnection({ initialState: CONNECTED_STATE });
  const handlers = createCarIpcHandlers(connection);

  await assert.rejects(
    () => handlers.handleSetMovement("diagonal" as MovementDirection),
    /Invalid movement direction/,
  );

  assert.deepEqual(connection.setMovementCalls, []);
});

test("handleSetMovement rejects an empty string direction without reaching connection.setMovement()", async () => {
  const connection = new FakeCarConnection({ initialState: CONNECTED_STATE });
  const handlers = createCarIpcHandlers(connection);

  await assert.rejects(() => handlers.handleSetMovement("" as MovementDirection));

  assert.deepEqual(connection.setMovementCalls, []);
});

const INHERITED_OBJECT_PROTOTYPE_NAMES = [
  "constructor",
  "toString",
  "hasOwnProperty",
  "valueOf",
  "__proto__",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "toLocaleString",
];

for (const direction of INHERITED_OBJECT_PROTOTYPE_NAMES) {
  test(`handleSetMovement rejects inherited Object.prototype name "${direction}" without reaching connection.setMovement()`, async () => {
    const connection = new FakeCarConnection({ initialState: CONNECTED_STATE });
    const handlers = createCarIpcHandlers(connection);

    await assert.rejects(
      () => handlers.handleSetMovement(direction as MovementDirection),
      /Invalid movement direction/,
    );

    assert.deepEqual(connection.setMovementCalls, []);
  });
}

test("handleSetMovement rejects when connection.setMovement() rejects", async () => {
  const connection = new FakeCarConnection({
    onSetMovement: async () => {
      throw new Error('sendCommandFrame() called while status is "disconnected" and protocol is "null"');
    },
  });
  const handlers = createCarIpcHandlers(connection);

  await assert.rejects(() => handlers.handleSetMovement("forward"), /sendCommandFrame/);
});

test("handleShoot calls connection.shoot() exactly once", async () => {
  const connection = new FakeCarConnection({ initialState: CONNECTED_STATE });
  const handlers = createCarIpcHandlers(connection);

  await handlers.handleShoot();

  assert.equal(connection.shootCallCount, 1);
});

test("handleShoot rejects when connection.shoot() rejects", async () => {
  const connection = new FakeCarConnection({
    onShoot: async () => {
      throw new Error('sendCommandFrame() called while status is "disconnected" and protocol is "null"');
    },
  });
  const handlers = createCarIpcHandlers(connection);

  await assert.rejects(() => handlers.handleShoot(), /sendCommandFrame/);
});

const VALID_AIM_ANGLES = [1, 5, 45, 90, 135, 179, 180];

for (const angle of VALID_AIM_ANGLES) {
  test(`handleSetAimAngle calls connection.setAimAngle(${angle})`, async () => {
    const connection = new FakeCarConnection({ initialState: CONNECTED_STATE });
    const handlers = createCarIpcHandlers(connection);

    await handlers.handleSetAimAngle(angle);

    assert.deepEqual(connection.setAimAngleCalls, [angle]);
  });
}

const INVALID_AIM_ANGLES = [0, -1, 181, 500, 1.5, NaN, Infinity, -Infinity];

for (const angle of INVALID_AIM_ANGLES) {
  test(`handleSetAimAngle rejects out-of-range angle ${angle} without reaching connection.setAimAngle()`, async () => {
    const connection = new FakeCarConnection({ initialState: CONNECTED_STATE });
    const handlers = createCarIpcHandlers(connection);

    await assert.rejects(() => handlers.handleSetAimAngle(angle), /Invalid aim angle/);

    assert.deepEqual(connection.setAimAngleCalls, []);
  });
}

test("handleSetAimAngle rejects a non-number angle without reaching connection.setAimAngle()", async () => {
  const connection = new FakeCarConnection({ initialState: CONNECTED_STATE });
  const handlers = createCarIpcHandlers(connection);

  await assert.rejects(
    () => handlers.handleSetAimAngle("90" as unknown as number),
    /Invalid aim angle/,
  );

  assert.deepEqual(connection.setAimAngleCalls, []);
});

test("handleSetAimAngle rejects when connection.setAimAngle() rejects", async () => {
  const connection = new FakeCarConnection({
    onSetAimAngle: async () => {
      throw new Error('sendCommandFrame() called while status is "disconnected" and protocol is "null"');
    },
  });
  const handlers = createCarIpcHandlers(connection);

  await assert.rejects(() => handlers.handleSetAimAngle(90), /sendCommandFrame/);
});

const VALID_DISTANCE_SENSOR_ANGLES = [1, 5, 45, 90, 135, 179, 180];

for (const angle of VALID_DISTANCE_SENSOR_ANGLES) {
  test(`handleSetDistanceSensorAngle calls connection.setDistanceSensorAngle(${angle})`, async () => {
    const connection = new FakeCarConnection({ initialState: CONNECTED_STATE });
    const handlers = createCarIpcHandlers(connection);

    await handlers.handleSetDistanceSensorAngle(angle);

    assert.deepEqual(connection.setDistanceSensorAngleCalls, [angle]);
  });
}

const INVALID_DISTANCE_SENSOR_ANGLES = [0, -1, 181, 500, 1.5, NaN, Infinity, -Infinity];

for (const angle of INVALID_DISTANCE_SENSOR_ANGLES) {
  test(`handleSetDistanceSensorAngle rejects out-of-range angle ${angle} without reaching connection.setDistanceSensorAngle()`, async () => {
    const connection = new FakeCarConnection({ initialState: CONNECTED_STATE });
    const handlers = createCarIpcHandlers(connection);

    await assert.rejects(
      () => handlers.handleSetDistanceSensorAngle(angle),
      /Invalid distance sensor angle/,
    );

    assert.deepEqual(connection.setDistanceSensorAngleCalls, []);
  });
}

test("handleSetDistanceSensorAngle rejects a non-number angle without reaching connection.setDistanceSensorAngle()", async () => {
  const connection = new FakeCarConnection({ initialState: CONNECTED_STATE });
  const handlers = createCarIpcHandlers(connection);

  await assert.rejects(
    () => handlers.handleSetDistanceSensorAngle("90" as unknown as number),
    /Invalid distance sensor angle/,
  );

  assert.deepEqual(connection.setDistanceSensorAngleCalls, []);
});

test("handleSetDistanceSensorAngle rejects when connection.setDistanceSensorAngle() rejects", async () => {
  const connection = new FakeCarConnection({
    onSetDistanceSensorAngle: async () => {
      throw new Error('sendCommandFrame() called while status is "disconnected" and protocol is "null"');
    },
  });
  const handlers = createCarIpcHandlers(connection);

  await assert.rejects(() => handlers.handleSetDistanceSensorAngle(90), /sendCommandFrame/);
});

test("forwardConnectionStatus forwards every state-change event", () => {
  const connection = new FakeCarConnection();
  const received: ConnectionState[] = [];

  forwardConnectionStatus(connection, (state) => {
    received.push(state);
  });

  connection.setState({ status: "connecting", protocol: null, message: null });
  connection.setState(CONNECTED_STATE);

  assert.deepEqual(received, [
    { status: "connecting", protocol: null, message: null },
    CONNECTED_STATE,
  ]);
});

test("forwardConnectionStatus's unsubscribe stops further forwarding", () => {
  const connection = new FakeCarConnection();
  const received: ConnectionState[] = [];

  const unsubscribe = forwardConnectionStatus(connection, (state) => {
    received.push(state);
  });
  unsubscribe();

  connection.setState(CONNECTED_STATE);

  assert.deepEqual(received, []);
});

test('forwardWifiLogLines forwards every "log-lines" batch as a single call', () => {
  const connection = new FakeCarConnection();
  const received: string[][] = [];

  forwardWifiLogLines(connection, (lines) => {
    received.push(lines);
  });

  connection.emit("log-lines", ["[00:00:00.000] first", "[00:00:00.001] second"]);
  connection.emit("log-lines", ["[00:00:00.002] third"]);

  assert.deepEqual(received, [
    ["[00:00:00.000] first", "[00:00:00.001] second"],
    ["[00:00:00.002] third"],
  ]);
});

test("forwardWifiLogLines's unsubscribe stops further forwarding", () => {
  const connection = new FakeCarConnection();
  const received: string[][] = [];

  const unsubscribe = forwardWifiLogLines(connection, (lines) => {
    received.push(lines);
  });
  unsubscribe();

  connection.emit("log-lines", ["[00:00:00.000] should not arrive"]);

  assert.deepEqual(received, []);
});

test("integration: handleConnect against a real CarConnection forwards status pushes", async () => {
  // Stands in for the "manually verified via devtools console" criterion:
  // this drives the exact same createCarIpcHandlers/forwardConnectionStatus
  // path a devtools-console call to window.carAPI.connect() would hit, just
  // with a local mock TCP server in place of the physical car and a plain
  // callback in place of webContents.send.
  const server = net.createServer((socket) => socket.on("error", () => {}));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as net.AddressInfo;

  try {
    const connection = new CarConnection({ host: "127.0.0.1", tcpPort: port, timeoutMs: 500 });
    const handlers = createCarIpcHandlers(connection);
    const pushedStates: ConnectionState[] = [];
    const unsubscribe = forwardConnectionStatus(connection, (state) => {
      pushedStates.push(state);
    });

    await handlers.handleConnect();

    assert.equal(connection.getState().status, "connected");
    assert.equal(connection.getState().protocol, "tcp100");
    assert.deepEqual(pushedStates, [
      { status: "connecting", protocol: null, message: null },
      connection.getState(),
    ]);

    const disconnectedPush = new Promise<void>((resolve) => {
      connection.on("state-change", function onStateChange(state) {
        if (state.status === "disconnected") {
          connection.off("state-change", onStateChange);
          resolve();
        }
      });
    });
    await handlers.handleDisconnect();
    await disconnectedPush;

    assert.equal(connection.getState().status, "disconnected");
    assert.equal(pushedStates.at(-1)?.status, "disconnected");

    unsubscribe();
  } finally {
    server.close();
  }
});
