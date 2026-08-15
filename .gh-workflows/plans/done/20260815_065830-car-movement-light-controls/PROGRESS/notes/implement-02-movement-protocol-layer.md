# Session notes: implement/02-movement-protocol-layer

## What was built

Extended the TCP:100 command-frame protocol layer to support direct motor
control, per ADR-001. No UI/IPC/renderer changes — those are ticket 03.

### `app/src/commandFrame.ts`

- `export const DEVICE_MOTOR = 0x0c;` — motor device code.
- `export type MovementDirection = "stop" | "forward" | "backward" | "left" | "right" | "rotate-left" | "rotate-right";`
- `export const MOVEMENT_VALUES: Record<MovementDirection, number>` — maps
  each direction to its exact wire value byte:
  - `stop: 0x00`
  - `forward: 0x01`
  - `backward: 0x02`
  - `left: 0x03`
  - `right: 0x04`
  - `"rotate-left": 0x09`
  - `"rotate-right": 0x0a`
- Diagonals (0x05-0x08) intentionally left undeclared — out of scope per ADR-001.

### `app/src/carConnection.ts`

- `async setMovement(direction: MovementDirection): Promise<void>` — new
  method on `CarConnection`, added right after `setLedState()`. Exact same
  shape/contract as `setLedState()`:
  - Calls `this.sendCommandFrame(buildCommandFrame({ action: CMD_RUN, device: DEVICE_MOTOR, value: MOVEMENT_VALUES[direction] }))`.
  - Gating/rejection is inherited from `sendCommandFrame()` — rejects
    synchronously with the same error messages as `setLedState()`:
    - `sendCommandFrame() called while status is "disconnected" and protocol is "null"` when disconnected.
    - `...protocol is "http80"` when connected but on http80 (no command channel on that path).
  - No new gating logic was written — it reuses `sendCommandFrame()`'s
    existing check, so ticket 03's IPC layer / renderer can call
    `carConnection.setMovement("forward")` etc. and get the exact same
    rejection contract as `setLedState()`.

## Exact API shape for ticket 03 to consume

```ts
import type { MovementDirection } from "./commandFrame.ts";
// MovementDirection = "stop" | "forward" | "backward" | "left" | "right" | "rotate-left" | "rotate-right"

await carConnection.setMovement(direction); // direction: MovementDirection
```

This matches ADR-001's stated IPC channel contract exactly (`car:set-movement`
carrying a direction string `"forward"`, `"backward"`, `"left"`, `"right"`,
`"rotate-left"`, `"rotate-right"`, `"stop"`) — ticket 03 can pass the IPC
payload's direction string straight through to `setMovement()` without any
extra mapping step, as long as the renderer/IPC layer uses these exact string
literals.

## Tests added

- `app/src/commandFrame.test.ts`: one parameterized test per direction (7
  total) asserting `buildCommandFrame({ action: CMD_RUN, device: DEVICE_MOTOR, value: MOVEMENT_VALUES[direction] })`
  produces the exact ADR-001 byte sequence
  `[0xff, 0x55, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x0c, 0x00, <value>]`.
- `app/src/carConnection.test.ts`: mirrors the existing `setLedState()` test
  coverage exactly:
  - One test per direction (7 total) using the mock-TCP-server pattern
    (`captureServerSocket()` + `startMockTcpServer()`), asserting the exact
    bytes written to the server-side socket for `setMovement(direction)`.
  - `setMovement() rejects without writing to the socket when disconnected`.
  - `setMovement() rejects without writing to the socket on an http80 session`
    (also asserts no extra HTTP request was made beyond the initial probe).

All tests written test-first (confirmed failing before implementation, e.g.
`SyntaxError: does not provide an export named 'DEVICE_MOTOR'` and 9 failing
`carConnection.test.ts` tests referencing `setMovement`), then made to pass.

## Verification run at end of session

- `npx tsc --noEmit` — clean, no errors.
- `npm test` (full suite) — 63/63 passing (added 7 new commandFrame.test.ts
  cases + 9 new carConnection.test.ts cases this ticket, all green).

## Gotchas / notes for next session (ticket 03)

- No coding-rule conflicts this session — `general.md` applied cleanly (no UI
  work happened, so the Playwright/manual-verification conflict from ticket
  01 didn't recur here). `node-typescript-docker.md` does not apply — this
  project has no Dockerfile/docker-compose and isn't NestJS/Next.js.
- `setMovement()`'s rejection error messages are identical in shape to
  `setLedState()`'s (same `sendCommandFrame()` guard is shared), so any IPC
  error-mapping/handling ticket 03 writes for lights can be reused verbatim
  for movement — no new error-message parsing needed.
- Frame format itself is completely unchanged — only a new device code
  (`DEVICE_MOTOR = 0x0c`) and its value table were added. `buildCommandFrame()`
  was not touched.
- Ticket 03 will need to add the `car:set-movement` IPC channel (see
  `ipcChannels.ts` for the existing `car:set-lights` pattern), wire it in
  `carIpcHandlers.ts` and `preload.ts`, and implement the press-and-hold
  D-pad UI in `renderer.ts`/`index.html` per ADR-001's interaction model
  (pointerdown sends direction, pointerup/pointerleave/pointercancel/
  window.blur send stop, single `activeDirection` state with interrupt
  semantics — see ADR-001 for full detail). None of that IPC/UI work was
  started in this ticket.
