import assert from "node:assert/strict";
import * as http from "node:http";
import * as net from "node:net";
import { afterEach, test } from "node:test";

import { CarConnection } from "./carConnection.ts";

// Short timeout so refused/unreachable-port scenarios resolve fast; the
// production default (carConfig.CAR_PROBE_TIMEOUT_MS) is tuned for a real
// Wi-Fi hop, which would make every test in this file slow.
const TEST_TIMEOUT_MS = 300;

// Ports nothing is listening on: not bound by any mock server started in
// this file, so connection attempts to them fail fast with ECONNREFUSED.
// This is how "TCP:100 doesn't respond" is exercised without needing a real
// network black hole to test an actual timeout.
const CLOSED_TCP_PORT = 1;
const CLOSED_HTTP_PORT = 2;

let tcpServer: net.Server | undefined;
let httpServer: http.Server | undefined;
let tcpServerSockets: Set<net.Socket> = new Set();

// server.close(callback) only fires its callback once every socket it ever
// accepted has closed. Tests that reach "connected" deliberately leave the
// CarConnection's socket open (that's the whole point of drop-detection
// tests), so teardown must force-destroy any still-open server-side sockets
// itself rather than waiting for the client to close them.
afterEach(async () => {
  for (const socket of tcpServerSockets) {
    socket.destroy();
  }
  tcpServerSockets = new Set();

  if (tcpServer) {
    await new Promise<void>((resolve) => tcpServer!.close(() => resolve()));
    tcpServer = undefined;
  }
  if (httpServer) {
    httpServer.closeAllConnections();
    await new Promise<void>((resolve) => httpServer!.close(() => resolve()));
    httpServer = undefined;
  }
});

function startMockTcpServer(onConnection?: (socket: net.Socket) => void): Promise<number> {
  return new Promise((resolve) => {
    tcpServer = net.createServer((socket) => {
      tcpServerSockets.add(socket);
      socket.once("close", () => tcpServerSockets.delete(socket));
      onConnection?.(socket);
    });
    tcpServer.listen(0, "127.0.0.1", () => {
      const address = tcpServer!.address();
      if (address === null || typeof address === "string") {
        throw new Error("expected TCP server to bind an ephemeral port");
      }
      resolve(address.port);
    });
  });
}

function startMockHttpServer(
  onRequest?: (req: http.IncomingMessage) => void,
): Promise<number> {
  return new Promise((resolve) => {
    httpServer = http.createServer((req, res) => {
      onRequest?.(req);
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html></html>");
    });
    httpServer.listen(0, "127.0.0.1", () => {
      const address = httpServer!.address();
      if (address === null || typeof address === "string") {
        throw new Error("expected HTTP server to bind an ephemeral port");
      }
      resolve(address.port);
    });
  });
}

test("connect() reaches connected with tcp100 when the TCP mock server accepts", async () => {
  const tcpPort = await startMockTcpServer();
  const connection = new CarConnection({
    host: "127.0.0.1",
    tcpPort,
    httpPort: CLOSED_HTTP_PORT,
    timeoutMs: TEST_TIMEOUT_MS,
  });

  await connection.connect();

  assert.deepEqual(connection.getState(), {
    status: "connected",
    protocol: "tcp100",
    message: `Connected to 127.0.0.1:${tcpPort} (TCP)`,
  });
});

test("connect() prefers tcp100 over http80 when both mock servers are up", async () => {
  const tcpPort = await startMockTcpServer();
  const httpPort = await startMockHttpServer();
  const connection = new CarConnection({
    host: "127.0.0.1",
    tcpPort,
    httpPort,
    timeoutMs: TEST_TIMEOUT_MS,
  });

  await connection.connect();

  assert.equal(connection.getState().protocol, "tcp100");
});

test("connect() falls back to http80 when TCP:100 does not respond", async () => {
  const httpPort = await startMockHttpServer();
  const connection = new CarConnection({
    host: "127.0.0.1",
    tcpPort: CLOSED_TCP_PORT,
    httpPort,
    timeoutMs: TEST_TIMEOUT_MS,
  });

  await connection.connect();

  assert.deepEqual(connection.getState(), {
    status: "connected",
    protocol: "http80",
    message: `Connected to 127.0.0.1:${httpPort} (HTTP)`,
  });

  // http80 sessions run a background liveness poll (see the drop-detection
  // tests below); disconnect() stops it so it doesn't outlive this test.
  await connection.disconnect();
});

test("http80 probe requests a bare path with no movement side effects", async () => {
  const requestedUrls: string[] = [];
  const httpPort = await startMockHttpServer((req) => {
    requestedUrls.push(req.url ?? "");
  });
  const connection = new CarConnection({
    host: "127.0.0.1",
    tcpPort: CLOSED_TCP_PORT,
    httpPort,
    timeoutMs: TEST_TIMEOUT_MS,
  });

  await connection.connect();

  assert.deepEqual(requestedUrls, ["/"]);
  assert.ok(!requestedUrls[0].includes("move"));

  await connection.disconnect();
});

test("connect() goes to error when neither port responds", async () => {
  const connection = new CarConnection({
    host: "127.0.0.1",
    tcpPort: CLOSED_TCP_PORT,
    httpPort: CLOSED_HTTP_PORT,
    timeoutMs: TEST_TIMEOUT_MS,
  });

  await connection.connect();

  const state = connection.getState();
  assert.equal(state.status, "error");
  assert.equal(state.protocol, null);
  assert.match(state.message ?? "", /unreachable/);
});

test("connect() rejects when a connection attempt is already in flight", async () => {
  const tcpPort = await startMockTcpServer();
  const connection = new CarConnection({
    host: "127.0.0.1",
    tcpPort,
    httpPort: CLOSED_HTTP_PORT,
    timeoutMs: TEST_TIMEOUT_MS,
  });

  const firstAttempt = connection.connect();
  await assert.rejects(() => connection.connect(), /status is "connecting"/);
  await firstAttempt;
});

test("connect() rejects when already connected", async () => {
  const tcpPort = await startMockTcpServer();
  const connection = new CarConnection({
    host: "127.0.0.1",
    tcpPort,
    httpPort: CLOSED_HTTP_PORT,
    timeoutMs: TEST_TIMEOUT_MS,
  });

  await connection.connect();

  await assert.rejects(() => connection.connect(), /status is "connected"/);
});

test("disconnect() rejects when not connected", async () => {
  const connection = new CarConnection({ timeoutMs: TEST_TIMEOUT_MS });

  await assert.rejects(() => connection.disconnect(), /status is "disconnected"/);
});

test("disconnect() while connected cleanly transitions to disconnected", async () => {
  const tcpPort = await startMockTcpServer();
  const connection = new CarConnection({
    host: "127.0.0.1",
    tcpPort,
    httpPort: CLOSED_HTTP_PORT,
    timeoutMs: TEST_TIMEOUT_MS,
  });
  await connection.connect();

  const stateChanges: string[] = [];
  connection.on("state-change", (state) => stateChanges.push(state.status));

  const disconnected = new Promise((resolve) => connection.once("state-change", resolve));
  await connection.disconnect();
  await disconnected;

  assert.deepEqual(connection.getState(), {
    status: "disconnected",
    protocol: null,
    message: null,
  });
  assert.deepEqual(stateChanges, ["disconnected"]);
});

test("a clean remote close while connected is detected as disconnected (event-based)", async () => {
  const tcpPort = await startMockTcpServer((socket) => {
    socket.end();
  });
  const connection = new CarConnection({
    host: "127.0.0.1",
    tcpPort,
    httpPort: CLOSED_HTTP_PORT,
    timeoutMs: TEST_TIMEOUT_MS,
  });

  // Listener registered before connect() (not after) and filtered to the
  // "disconnected" transition specifically: connect() itself emits
  // "connecting" and "connected" state-changes first, and the server's
  // socket.end() can race ahead of connect()'s own resolution, so a plain
  // once("state-change", ...) registered after awaiting connect() can miss
  // the drop entirely and hang forever waiting for an event that already
  // fired.
  const droppedState = new Promise((resolve) => {
    connection.on("state-change", function onStateChange(state) {
      if (state.status === "disconnected") {
        connection.off("state-change", onStateChange);
        resolve(state);
      }
    });
  });
  await connection.connect();

  assert.deepEqual(await droppedState, {
    status: "disconnected",
    protocol: null,
    message: null,
  });
});

test("an http80 session detects a drop via periodic liveness polling and goes to error", async () => {
  let requestCount = 0;
  const httpPort = await startMockHttpServer(() => {
    requestCount += 1;
  });
  const connection = new CarConnection({
    host: "127.0.0.1",
    tcpPort: CLOSED_TCP_PORT,
    httpPort,
    timeoutMs: TEST_TIMEOUT_MS,
    httpPollIntervalMs: 20,
  });

  await connection.connect();
  assert.equal(connection.getState().protocol, "http80");
  assert.equal(requestCount, 1, "the initial probe GET");

  // A failed poll GET carries no clean-vs-abrupt signal (see checkHttpLiveness()'s
  // doc comment) — an unanswered poll is always treated as an unexpected drop,
  // so this scenario (car going away mid-session) must land on "error", not
  // "disconnected". "disconnected" for an http80 session is reachable only via
  // the user's own disconnect() call — see the test below.
  const droppedState = new Promise((resolve) => {
    connection.on("state-change", function onStateChange(state) {
      if (state.status === "error") {
        connection.off("state-change", onStateChange);
        resolve(state);
      }
    });
  });

  // Simulate the car going away: the mock server stops accepting, so
  // subsequent poll GETs fail exactly like a real dropped Wi-Fi hotspot.
  httpServer!.closeAllConnections();
  await new Promise<void>((resolve) => httpServer!.close(() => resolve()));
  httpServer = undefined;

  const finalState = await droppedState;
  assert.equal((finalState as { status: string }).status, "error");
  assert.equal((finalState as { protocol: unknown }).protocol, null);
  assert.match((finalState as { message: string }).message, /stopped responding/);
});

test("disconnect() on an http80 session cleanly transitions to disconnected (not error)", async () => {
  const httpPort = await startMockHttpServer();
  const connection = new CarConnection({
    host: "127.0.0.1",
    tcpPort: CLOSED_TCP_PORT,
    httpPort,
    timeoutMs: TEST_TIMEOUT_MS,
    httpPollIntervalMs: 20,
  });

  await connection.connect();
  await connection.disconnect();

  assert.deepEqual(connection.getState(), {
    status: "disconnected",
    protocol: null,
    message: null,
  });
});

test("disconnect() on an http80 session stops the liveness poll (no leaked timer)", async () => {
  let requestCount = 0;
  const httpPort = await startMockHttpServer(() => {
    requestCount += 1;
  });
  const connection = new CarConnection({
    host: "127.0.0.1",
    tcpPort: CLOSED_TCP_PORT,
    httpPort,
    timeoutMs: TEST_TIMEOUT_MS,
    httpPollIntervalMs: 20,
  });

  await connection.connect();
  await connection.disconnect();

  const countAfterDisconnect = requestCount;
  await new Promise((resolve) => setTimeout(resolve, 80));

  assert.equal(
    requestCount,
    countAfterDisconnect,
    "no further poll GETs should fire after disconnect()",
  );
});

test("an abrupt remote close (socket error) while connected is detected as error", async () => {
  const tcpPort = await startMockTcpServer((socket) => {
    // resetAndDestroy() sends an actual RST packet, which is what makes the
    // client observe this as an abrupt error rather than a clean FIN close.
    // A plain destroy(err) only fires "error" locally on the server socket
    // and does not by itself send anything abnormal over the wire.
    //
    // Deferred one tick: calling resetAndDestroy() synchronously in the
    // "connection" handler can race the client's own "connect" event at the
    // TCP-stack level, occasionally beating it — the client then never
    // observes a completed handshake at all and treats this as a failed
    // probe attempt ("car unreachable") rather than the intended scenario,
    // a drop *after* the session is already "connected". setImmediate lets
    // the client's "connect" event fire first, deterministically.
    setImmediate(() => socket.resetAndDestroy());
  });
  const connection = new CarConnection({
    host: "127.0.0.1",
    tcpPort,
    httpPort: CLOSED_HTTP_PORT,
    timeoutMs: TEST_TIMEOUT_MS,
  });

  // Same race as the clean-close test above: register before connect() and
  // filter to "error" specifically, so the RST can't race ahead of the
  // listener and hang the test.
  const droppedState = new Promise<ReturnType<CarConnection["getState"]>>((resolve) => {
    connection.on("state-change", function onStateChange(state) {
      if (state.status === "error") {
        connection.off("state-change", onStateChange);
        resolve(state);
      }
    });
  });
  await connection.connect();

  const finalState = await droppedState;
  assert.equal(finalState.status, "error");
  assert.match(finalState.message ?? "", /Connection error/);
});
