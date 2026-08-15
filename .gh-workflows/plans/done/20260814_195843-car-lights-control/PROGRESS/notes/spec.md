# Session end-state: spec phase

## What happened

Synthesized the grill output (`grill/requirements.md`, `grill/decisions.md`, `grill/glossary.md`, `grill/ADR-001.md`) into `spec.md`. No user interview needed — `requirements.md`'s "Environment notes" section already had all the confirmed hardware/protocol/repo facts, so this phase explored the codebase only to identify test seams: read `app/src/carConnection.ts`, `carIpcHandlers.ts`, `connectionUiState.ts`, `preload.ts`, `renderer.ts`, `ipcChannels.ts`, `app/public/index.html`, and all three existing `*.test.ts` files to confirm the established test-seam patterns (pure-function input/output tests, `CarConnectionLike`-fake tests, mock-TCP-server tests).

Spec written to `spec.md` covering: mirrored left/right toggle UI, app-tracked optimistic state reset on connect, tcp100-only gating, a reusable binary-frame-builder pure function (per ADR-001), and a frame-sending capability added to the main-process car-connection layer with a new IPC channel through to the renderer.

## Draft ticket breakdown

1. **Command-frame protocol layer on `CarConnection`** (prefactor)
   - Blocked by: none — can start immediately
   - Delivers: A generic, tested binary-frame-building pure function per ADR-001's frame format (header, length byte, action/device/value payload offsets, zero-filled reserved bytes), plus a frame-sending capability on the main-process car-connection layer that writes an already-built frame over the open TCP socket only when the session's protocol is tcp100 (rejecting without writing when disconnected or on an http80 session). Covered by: pure-function unit tests for the frame builder across device/action/value combinations, and mock-TCP-server tests (same seam as `carConnection.test.ts`) asserting the exact bytes received on the wire for the LED-on/LED-off case, plus the reject-without-write cases. This ticket is also the first live-hardware confirmation opportunity for ADR-001's reverse-engineered frame format — not itself UI-visible, but independently verifiable via tests and a manual devtools-console-style call against the real car.

2. **Left/Right Light toggle buttons, IPC, and mirrored renderer state**
   - Blocked by: Ticket 1
   - Delivers: The full user-facing feature. New IPC channel wired through `carIpcHandlers.ts` (extending `CarConnectionLike` with the light-command method) and `preload.ts` (exposing a light-control call on `window.carAPI`, resolves-once-initiated/rejects-if-invalid per the existing connect/disconnect contract). Two "Left Light"/"Right Light" buttons added to `app/public/index.html` below the existing Connect/Disconnect control, sharing one mirrored on/off boolean in the renderer that updates optimistically on click, is disabled unless `status === "connected" && protocol === "tcp100"`, and resets to "off" on every fresh connect/reconnect or disconnect/error. Covered by: `FakeCarConnection`-based IPC handler tests (same seam as existing `handleConnect`/`handleDisconnect` tests) and a pure-function UI-state-mapping test (same seam as `connectionUiState.test.ts`) covering every combination of connection status/protocol against button enabled/disabled + mirrored label state.

No prefactor tickets beyond Ticket 1 were identified — the existing architecture (narrow `CarConnectionLike` interface, pure UI-state-mapping function, channel-name constants file) already supports this feature additively without needing to reshape any existing code first.

## Open items carried into spec's "Further Notes"

- Binary frame format unconfirmed against real hardware (live verification happens in ticket 1's implementation).
- Left/right GPIO mapping unconfirmed and explicitly left unresolved (low-stakes, cosmetic only).
- Single parameterized IPC channel (carrying an on/off value) chosen over two no-argument channels — a judgment call made in the spec, not an explicit grill decision.

## What's next

Tickets phase: read this file's "Draft ticket breakdown" as the starting point (per `tickets.md` step 1's carried-over-draft path), present it to the user for approval, then delegate the file write-up to `.gh-workflows/plans/20260814_195843-car-lights-control/tickets/01-...` and `02-...`.
