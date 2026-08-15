# Session notes: implement/01-command-frame-protocol-layer

## What was built

1. **`app/src/commandFrame.ts`** — new file. Pure `buildCommandFrame({ action, device, value })` function that
   builds the `0xFF 0x55 <length> <10-byte payload>` frame documented in `grill/ADR-001.md`, with reserved
   payload bytes (indices 0-5, 8) zero-filled and action/device/value written at payload indices 6/7/9. Also
   exports `CMD_RUN` (0x01) and `DEVICE_LED` (0x05) protocol constants. Generic across device/action/value —
   not LED-specific — per ADR-001's stated intent to be the canonical frame builder for future movement/buzzer/
   servo commands too.

2. **`app/src/commandFrame.test.ts`** — new file. 4 pure input/output-pair tests (`node:test` style, matching
   `connectionUiState.test.ts`'s convention): exact LED-on bytes, exact LED-off bytes, zero-fill verified with a
   non-LED device/action/value combination, and frame length is always 13 bytes.

3. **`app/src/carConnection.ts`** — two new public methods on `CarConnection`:
   - `sendCommandFrame(frame: Buffer): Promise<void>` — generic frame-sending capability. Rejects synchronously
     (before any write) unless `status === "connected" && protocol === "tcp100"` and a live socket exists.
     Otherwise writes the frame to the open TCP socket and resolves once the OS write callback fires.
   - `setLedState(on: boolean): Promise<void>` — LED-specific convenience built on top of `sendCommandFrame`,
     using `CMD_RUN`/`DEVICE_LED` and `value = on ? 1 : 0`. This is the method ticket 02's IPC handler should
     call.

4. **`app/src/carConnection.test.ts`** — 4 new tests using the existing mock-TCP-server pattern:
   - `setLedState(true)` / `setLedState(false)` each assert the mock server receives the exact ADR-001 on/off
     byte sequence on the wire (not just that the client-side write callback fired — the assertion waits on the
     *server socket's* `"data"` event, captured via a `captureServerSocket()` helper that resolves from
     `startMockTcpServer`'s `onConnection` callback, awaited alongside `connect()` itself with `Promise.all`).
     This was deliberately hardened against a real race: reading the shared `tcpServerSockets` set right after
     `await connection.connect()` resolves is **not** safe — under load, the client's `"connect"` event can
     resolve slightly before the server's `"connection"` handler has populated that set, causing an intermittent
     `undefined` read. Capturing the socket via the connection callback itself and `Promise.all`-ing it against
     `connect()` removed the race; confirmed stable across repeated full-suite runs.
   - `setLedState()` rejects without writing when disconnected (no socket exists).
   - `setLedState()` rejects without writing on an http80 session (asserted by checking no additional HTTP
     request count beyond the initial probe GET, since http80 never touches the TCP `sendCommandFrame` path at
     all — `protocol !== "tcp100"` short-circuits before any I/O).

## Verification run

- `npm test` (full suite, `app/`): 36/36 passing, run 3x to confirm no flakiness after the race fix above.
- `npx tsc --noEmit`: clean.
- `npm run build`: clean (both `tsconfig.build.json` and `tsconfig.renderer.json` targets).

## What ticket 02 needs to know

- **Call `connection.setLedState(on: boolean)`** from the new IPC handler — don't reach for
  `sendCommandFrame`/`buildCommandFrame` directly from the IPC layer; `setLedState` already encapsulates the
  LED-specific device/action codes.
- **`CarConnectionLike` interface extension is still ticket 02's job.** Ticket 01 deliberately did not touch
  `carIpcHandlers.ts` — per spec.md, extending `CarConnectionLike` with the light-command method (and the
  matching `FakeCarConnection` update in `carIpcHandlers.test.ts`) belongs to ticket 02's scope.
- **`setLedState()`'s rejection contract matches `connect()`/`disconnect()`'s existing pattern**: it throws
  synchronously-as-a-rejected-promise with a descriptive message (`sendCommandFrame() called while status is
  "X" and protocol is "Y"`) rather than returning a boolean or silently no-op'ing. The IPC handler in ticket 02
  should let this propagate the same way `handleConnect`/`handleDisconnect` already do (see
  `createCarIpcHandlers`'s doc comment on why rejections are relayed rather than swallowed).
- **No renderer/IPC-channel/preload work exists yet** — `ipcChannels.ts` and `preload.ts` are untouched by this
  ticket; ticket 02 adds a new channel constant and a `window.carAPI.setLightsOn(on)`-shaped (or similar) call
  following the existing `connect`/`disconnect` pattern described in spec.md.

## Gotchas / open items carried forward

- **Live-hardware confirmation is still outstanding and cannot be done from this sandboxed environment** (no
  network reachability to the physical car's Wi-Fi AP). ADR-001's frame format was reverse-engineered from
  firmware source, not live-tested; ticket 01's acceptance criterion for a manual devtools-console hardware
  check is left unchecked in `tickets/01-command-frame-protocol-layer.md`, with a note explaining why. This is
  flagged as a real risk (not blocking): if the compiled firmware's parser differs from the source examples
  ADR-001 was derived from, the reserved-byte assumptions may need adjustment. The user should run
  `window.carAPI` (once ticket 02 exposes a light-toggle call) or a devtools-console call to
  `connection.setLedState(true)` against their real QD001 once they have a session to test with, and report
  back if the LEDs don't respond as expected.
- **Left/right GPIO mapping remains unresolved and out of scope for ticket 01** — unaffected by this ticket
  since the frame/LED convenience is single, undifferentiated on/off, matching the mirrored-button design.
