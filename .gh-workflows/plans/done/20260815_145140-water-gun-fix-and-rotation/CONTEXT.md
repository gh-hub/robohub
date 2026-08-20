# Context: water-gun-fix-and-rotation

## What we're building
Fix the QD005 water-gun aim control (mislabeled as up/down when it actually pans the ultrasonic distance sensor left/right) and diagnose the non-firing shoot button, plus add discrete 90°/180° left/right rotation buttons to the movement controls.

## Key decisions
- **D1 — Firmware/pin match confirmed:** User verified physical car runs stock ACEBOTT QD005 firmware; GPIO 26 / device `0x02` is the target servo. Verified against actual `.ino` sketches. No firmware changes needed.
- **D2 — Repurpose Aim Up/Down into Pan Left/Right:** [ADR-001.md](grill/ADR-001.md) — rename all Aim identifiers/labels/types to Pan, keeping mechanics unchanged.
- **D3 — Shoot diagnosed as hardware issue, not code bug:** App's `DEVICE_SHOOT = 0x08` command already matches firmware exactly; UI gating verified correct. Issue is wiring/motor/`U4` driver chip on QA052 shield. No code fix.
- **D4 — Add 4 discrete rotate buttons:** [ADR-002.md](grill/ADR-002.md) — 90°/180° left/right via timed pulse (400ms/800ms), with interrupt/disable-during-action semantics. Durations are placeholders pending hardware calibration.

## Current state
Phase: review (round 2)
Completed tickets: 01 — Pan rename (Aim → Pan); 02 — Discrete rotate buttons (90°/180° Left/Right); round-1 fix 01 — Fix failing usbStatus test on Windows
Current ticket: (none)
Plan complete.

Review round 1 failed: spec-match and security both clean, but the unit/integration test gate failed (148/149) on a pre-existing, unrelated `usbStatus.test.ts` platform gap (test doesn't mock `process.platform` to `"darwin"`). Fixed in round-1-fix-01 (test-only change, mocked `process.platform` to `"darwin"` matching the sibling test's pattern) — all 149 tests now pass; typecheck and build remain clean. See [review/round-1/findings.md](review/round-1/findings.md) (historical) and [PROGRESS/notes/implement-round-1-fix-01-usbstatus-test.md](PROGRESS/notes/implement-round-1-fix-01-usbstatus-test.md).

## Tickets

1. **01 — Pan rename (Aim → Pan)**: Rename all Aim identifiers/labels/HTML ids/types to Pan across renderer, connection UI state mapping, HTML, and IPC method (setAimAngle → setPanAngle), plus rename all related tests. No behavior change.
2. **02 — Discrete rotate buttons (90°/180° Left/Right)**: Add four new one-click rotate buttons with timed pulse (400ms/800ms) and full interrupt/disable-during-action semantics, reusing existing rotate-left/rotate-right commands.

## Load this session
[Spec](spec.md) — full spec for the Pan rename, Shoot diagnosis, and discrete rotate buttons work under review.
[Ticket 01 — Pan rename](tickets/01-pan-rename.md) and [Ticket 02 — Discrete rotate buttons](tickets/02-discrete-rotate-buttons.md) — the two original feature tickets to spec-match against.
[Review round-1 findings](review/round-1/findings.md) is historical only — round 1's single blocking issue (148/149 test gate failure) is resolved; its spec-match and security findings were already clean and remain valid. Round 2 should re-run the full gate (tests/typecheck/build) plus spec-match and security against the current diff, not re-litigate round-1's already-clean areas.

## Gotchas
- The IPC channel string constant (`ipcChannels.ts`'s `CAR_SET_AIM_ANGLE_CHANNEL`/`"car:set-aim-angle"`) was renamed along with the TypeScript identifier during the Pan rename (to `CAR_SET_PAN_ANGLE_CHANNEL`/`"car:set-pan-angle"`), even though the ticket only required the identifier — judged safe since the string has no external consumers. See implement-01 notes for full reasoning.
- `carConnection.ts`'s `CarConnection.setAimAngle()` also had to be renamed to `setPanAngle()` during the Pan rename, even though the ticket's IPC-rename criterion didn't explicitly list `carConnection.ts` — it's required because `CarConnectionLike` (in `carIpcHandlers.ts`) is a structural interface `CarConnection` satisfies by shape, not by explicit `implements`.
- Ticket 01's "Manual/visual check" acceptance box was left unchecked — no Electron app or physical hardware was available in that session, and Playwright isn't set up yet for this project. `npm run build`/`typecheck`/`test` all pass, but the actual rendered UI is unverified.
- Ticket 02's "Manual/visual check" acceptance box was also left unchecked, for the same underlying reason. This session went one step further and attempted `npx electron .` directly (no project run/Playwright skill exists for this repo) — the process launched but hit GPU-process/network-service errors typical of a headless/no-display environment, so no window content could actually be observed or clicked. **Neither ticket's UI has been visually verified yet** — review should flag this as an open item, and a follow-up to set up Playwright per the coding rules' "UI verification" rule (then click through both the Pan-rename UI and the new discrete-rotate buttons together) is recommended.
- The pre-existing `usbStatus.test.ts` platform-mock gap (`isUsbSerialDevicePresent returns true when a cu.usbserial-* entry exists...` failing on Windows) was fixed in round-1-fix-01: the test now mocks `process.platform` to `"darwin"` matching the sibling test's existing pattern. `npm test` now reports 149/149. See [PROGRESS/notes/implement-round-1-fix-01-usbstatus-test.md](PROGRESS/notes/implement-round-1-fix-01-usbstatus-test.md).
- `ROTATE_90_MS`/`ROTATE_180_MS` (400ms/800ms, in `renderer.ts`) are explicitly unverified placeholder pulse durations pending real hardware calibration, per ADR-002 — not a bug if review notices they look arbitrary.
