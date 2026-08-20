# Implement notes: round-1 fix 01 — Fix failing usbStatus test on Windows

## What was fixed

The test `isUsbSerialDevicePresent returns true when a cu.usbserial-* entry exists in the
directory` (`app/src/usbStatus.test.ts:13-18`) was failing on this Windows dev machine because it
never mocked `process.platform` before asserting the macOS-only code path in
`isUsbSerialDevicePresent()` (`app/src/usbStatus.ts:33-42`, which returns `false` immediately when
`process.platform !== "darwin"` by design, per ADR-002 — USB-serial detection is macOS-only).

Applied the same `process.platform` mock pattern already used by the sibling test three lines
below (`usbStatus.test.ts:31-42`, "returns false on non-macOS platforms..."): wrapped the
assertion in `Object.defineProperty(process, "platform", { value: "darwin" })` with a `try/finally`
restore to `originalPlatform`. This is a test-only change — `app/src/usbStatus.ts` (production
code) was not touched, confirmed via `git diff --stat` showing only `usbStatus.test.ts` modified.

## Test results

- `npm test` (`app/`): **149/149 passing** (up from 148/149) — no other regressions.
- `npm run typecheck` (`app/`): clean, zero errors.
- `npm run build` (`app/`): clean, both tsc projects (`tsconfig.build.json`, `tsconfig.renderer.json`)
  compile.

## Decisions / judgment calls

None beyond the ticket's explicit instructions — the fix was a direct, mechanical application of
the sibling test's existing mock pattern, exactly as the ticket described. No ambiguity to note.

## What the review phase needs to know

- All 149 tests now pass on Windows; the pre-existing platform gap flagged in round-1 review is
  resolved. The full round-1 fix ticket (`review/round-1/tickets/01-fix-usbstatus-test.md`) has all
  four acceptance boxes checked.
- The two open items carried over from round-1 (not part of this fix ticket, still outstanding):
  - Neither ticket 01 (Pan rename) nor ticket 02 (discrete rotate buttons) has an actual
    manual/visual click-through verification yet — no Electron app/physical hardware session was
    available, and Playwright isn't set up in this repo. Both tickets' "Manual/visual check" boxes
    remain unchecked.
  - `ROTATE_90_MS`/`ROTATE_180_MS` (400ms/800ms, in `renderer.ts`) remain unverified placeholder
    pulse durations pending real hardware calibration, per ADR-002 — expected, not a bug.
- Round-1's `findings.md` is now historical only — its single blocking issue (the 148/149 test gate
  failure) is resolved by this fix. The spec-match and security findings from round-1 were already
  clean and remain valid; round-2 review should re-run the full gate (tests/typecheck/build) plus
  spec-match and security against the current diff, not re-litigate round-1's already-clean areas.
