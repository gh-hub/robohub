import type { ConnectionState } from "./carConnection.ts";

/**
 * The subset of `CarConnection`'s public surface these handlers depend on.
 * A narrow interface (rather than the concrete class) so tests can pass a
 * lightweight fake instead of standing up a real socket-backed instance,
 * per spec.md's IPC-contract testing decision.
 */
export interface CarConnectionLike {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  setLedState(on: boolean): Promise<void>;
  getState(): ConnectionState;
  on(event: "state-change", listener: (state: ConnectionState) => void): unknown;
  off(event: "state-change", listener: (state: ConnectionState) => void): unknown;
}

export interface CarIpcHandlers {
  handleConnect: () => Promise<void>;
  handleDisconnect: () => Promise<void>;
  handleSetLights: (on: boolean) => Promise<void>;
}

/**
 * Plain, Electron-free handler functions for the `connect`/`disconnect`
 * IPC channels. Per spec.md's IPC contract, these resolve once the action
 * has been *initiated* — not once the resulting state has settled — and
 * reject if the requested action doesn't make sense in the connection's
 * current state (e.g. `connect` while already `connecting`).
 * `CarConnection.connect()`/`.disconnect()` already reject synchronously
 * for those cases, so letting the rejection propagate here is what relays
 * it to the renderer once an adapter wires this onto `ipcMain.handle`.
 *
 * Deliberately does NOT resolve with `connection.getState()`: for a
 * connected TCP session, `disconnect()` resolves as soon as the socket's
 * `destroy()` is issued, before the `close` event (and the resulting
 * state-change to `disconnected`) has actually fired — resolving with
 * `getState()` here would return a stale "connected" snapshot. The
 * status-push channel (`forwardConnectionStatus`) is the single source of
 * truth the renderer should render from, per spec.md.
 *
 * `handleSetLights` follows the same resolve-once-initiated contract:
 * `CarConnection.setLedState()` already rejects synchronously (before any
 * write) when there's no active tcp100 session, and that rejection is
 * relayed here rather than swallowed, matching `handleConnect`/
 * `handleDisconnect`.
 */
export function createCarIpcHandlers(connection: CarConnectionLike): CarIpcHandlers {
  return {
    handleConnect: () => connection.connect(),
    handleDisconnect: () => connection.disconnect(),
    handleSetLights: (on: boolean) => connection.setLedState(on),
  };
}

/**
 * Subscribes `sendStatus` to every future state change on `connection`.
 * Returns an unsubscribe function. An adapter wires `sendStatus` to
 * `webContents.send(CAR_STATUS_CHANNEL, state)`; kept as a plain function
 * here so the forwarding logic itself is testable without a real
 * `WebContents`.
 */
export function forwardConnectionStatus(
  connection: CarConnectionLike,
  sendStatus: (state: ConnectionState) => void,
): () => void {
  const onStateChange = (state: ConnectionState): void => {
    sendStatus(state);
  };

  connection.on("state-change", onStateChange);

  return () => {
    connection.off("state-change", onStateChange);
  };
}
