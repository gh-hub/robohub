# Notes: implement/review-round-1-fix-01-security-cap-log-line-buffer

## What was built

Fixed the review round 1 security finding: `LogLineBuffer.push()`'s internal
`pending` string had no size cap, so a peer that never sends `\n` (the
unencrypted tcp100 socket in `carConnection.ts`, or a malfunctioning/malicious
CH340 device in `usbSerialConnection.ts`) could grow it forever and exhaust
the Electron main process's memory.

`app/src/logLineBuffer.ts`:
- Added `export const MAX_PENDING_LENGTH = 16 * 1024` (16 KB, in UTF-16 code
  units) — generous for any real log line, small enough to bound memory.
- In `push()`, after the `\n`-split and `segments.pop()` reassigns
  `this.pending`, added: if `this.pending.length > MAX_PENDING_LENGTH`, reset
  `this.pending = ""`. No line is emitted for the discarded data (it's
  dropped before the `segments.length === 0` early return / before the
  timestamp map), so a caller never sees a truncated/corrupt line — buffering
  just resumes cleanly from the next chunk.
- Updated the class doc comment (was "unbounded incoming byte/string
  stream", now describes the cap and discard behavior).

No changes needed in `carConnection.ts` or `usbSerialConnection.ts` — both
just do `new LogLineBuffer()` and iterate `push(chunk)`'s returned lines; the
cap is entirely internal to the buffer and transparent to both call sites.

## TDD process followed

1. Read existing `app/src/logLineBuffer.test.ts` (12 tests, all passing) to
   understand established test style/conventions.
2. Wrote two new tests first (importing a not-yet-existing
   `MAX_PENDING_LENGTH` export) and confirmed they failed with a clear
   "export not found" error — proving the tests actually exercise new code,
   not a no-op.
3. Implemented the cap in `logLineBuffer.ts`.
4. Reran — one test failed because of a test-design mistake on my part (see
   below), not a code bug. Fixed the test, reran — all 14 tests (12 existing
   + 2 new) pass.
5. Ran `npm run typecheck` — clean.
6. Ran full `npm test` — 208/208 pass (was 206 before this ticket; +2 new
   tests here).

### Test-design gotcha worth remembering

My first version of the "20 cumulative newline-free chunks" test asserted
the eventual line emitted after a final `"tail\n"` push would be exactly
`"tail"` — that's wrong reasoning: since no `\n` ever separated the
(possibly-partially-discarded) accumulated `x`'s from `"tail"`, they
legitimately concatenate into one line once a newline finally arrives — cap
resets only stop *unbounded* growth, they don't insert a boundary. Fixed by
asserting the flushed line's length stays well under
`chunkCount * chunkWithNoNewline.length` (proving discards happened along
the way) instead of asserting an exact `"tail"`-only match.

## Ticket status

All 5 acceptance criteria in
`review/round-1/tickets/01-security-cap-log-line-buffer.md` checked off
`[x]` with brief evidence notes inline.

## What the next session (ticket 02) needs to know

- Ticket 02 is `review/round-1/tickets/02-spec-usb-connect-contract-and-error-surfacing.md`
  — the spec-match finding about `UsbSerialConnection.connect()` rejecting
  asynchronously (unlike `CarConnection.connect()`, which always resolves)
  and the lack of any operator-facing UI surfacing for a failed USB Log
  Connect attempt (currently just `console.error(...)` in
  `renderer.ts`'s `handleUsbLogToggleClick`). See findings.md's "(c)
  Implemented but diverges from spec" section for full detail, and
  `PROGRESS/notes/implement-04-usb-log-panel.md` for the original reasoning
  behind the deviation (it was a deliberate, documented tradeoff at the
  time — review has now decided it needs a real fix, likely a status-push
  channel or inline error UI, not just documentation).
- Ticket 03 (`03-spec-remove-unrequested-dev-script.md`) is still pending
  after ticket 02 — the `"dev": "npm run start"` scope-creep line in
  `app/package.json` flagged in findings.md's "(b) Scope creep" section.
- No gotchas left behind by this ticket — the fix was self-contained to
  `logLineBuffer.ts`/`logLineBuffer.test.ts`, no follow-up work implied for
  either call site.
