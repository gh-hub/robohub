# Review round 1 findings

## Spec match

No findings.

Verified the diff (`git diff -- app/`) against `spec.md` with a full read plus targeted greps for leftover "aim" naming, a TypeScript compile check, and the test suite run.

**(a) Missing/partial requirements:** None found. Every ADR-001/ADR-002 item is implemented: the Pan rename is mechanically complete across `renderer.ts`, `connectionUiState.ts` (+tests), `preload.ts`, `main.ts`, `ipcChannels.ts`, `carIpcHandlers.ts` (+tests), `carConnection.ts` (+tests), and `index.html`; `window.carAPI.setAimAngle` was renamed to `setPanAngle` end-to-end as the spec's resolved decision required. The four discrete-rotate buttons, `ROTATE_90_MS`/`ROTATE_180_MS` placeholder constants with the required calibration comment, `rotateCooldownActive`, `handleDiscreteRotate`, the blur-handler cleanup, and the `onStatus` connection-drop cleanup are all present and match the spec's described control flow (`stopActiveMovement()` → set cooldown+render → `sendMovement()` → timeout → stop+clear+render).

**(b) Scope creep:** None. `git diff --stat` shows only the files the spec's scope implies; no `renderer.test.ts` or other new test infra was added (spec explicitly forbids this); no firmware/`.ino` changes; no `commandFrame.ts`/`carConnection.ts` protocol changes for rotate beyond an unchanged comment.

**(c) Implemented-but-wrong:** None found. The "up→left, down→right mapping, not flipped" requirement is preserved exactly. `renderMovement()` correctly folds `rotateCooldownActive` across all 10 buttons (4 D-pad + 2 continuous rotate + 4 discrete), satisfying user story 6.

Verification: `npx tsc --noEmit` is clean; `npm test` passes 148/149 (the one failure, `usbStatus.test.ts`'s macOS-only `cu.usbserial-*` detection test, is a pre-existing platform-dependent failure on Windows, unrelated to this diff — no code in this diff touches `usbStatus.ts`). A repo-wide `grep -rniE "aim"` over `app/src` and `app/public` returns zero matches, confirming user story 8's "no leftover aim/up/down naming" requirement.

## Security

No findings.

Reviewed the full `app/` diff (974 lines). This changeset is almost entirely a mechanical rename — `aim`/`Aim` → `pan`/`Pan` across `carConnection.ts`, `carIpcHandlers.ts`, `commandFrame.ts`, `connectionUiState.ts`, `ipcChannels.ts`, `main.ts`, `preload.ts`, `renderer.ts`, `index.html`, and their tests — plus one additive feature: four new discrete-rotate buttons wired through `renderer.ts`'s `handleDiscreteRotate()`.

Checked against the standard vulnerability-class baseline, in context (local Electron app, single operator, TCP link to a hobby robot, no accounts/network-facing API):
- **Input validation**: `isValidPanAngle()` still enforces `Number.isInteger(value) && value >= 1 && value <= 180` at the IPC trust boundary before calling `connection.setPanAngle()`. No regression.
- **IPC surface**: `CAR_SET_PAN_ANGLE_CHANNEL` is a straight rename of `CAR_SET_AIM_ANGLE_CHANNEL`; no new channel, no new data crossing the preload bridge, no relaxation of `contextIsolation`/`nodeIntegration`.
- **New discrete-rotate feature**: `handleDiscreteRotate(direction, angleDegrees)` takes `angleDegrees` only from a hardcoded literal array (`90 | 180` typed), not user-controlled; the pulse duration is a fixed constant. No injectable value reaches `sendMovement()`.
- **XSS**: The one text-rendering change (`angleText.textContent`) uses `textContent`, not `innerHTML`.
- **Secrets/config/crypto/CORS/deserialization/SSRF/path traversal/CSRF**: no lines in this diff touch any of these areas.

No concrete, exploitable issues introduced by this diff.

## Gate checks

| Check | Result | Notes |
|---|---|---|
| Lint | N/A | No lint script in `app/package.json`; no ESLint config found in `app/` |
| Build | PASS | `npm run build` in `app/`: clean, no errors |
| Typecheck | PASS | `npm run typecheck` in `app/`: clean, no errors |
| Unit/integration tests | FAIL | 148/149 passing. Reran the full suite once per process — same result both times, so this is a genuine failure, not flaky. See detail below. |
| E2E tests | N/A | No e2e suite exists in this project (no playwright/cypress config or script) |

### Test failure detail

```
✖ isUsbSerialDevicePresent returns true when a cu.usbserial-* entry exists in the directory (5.3662ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  false !== true
      at TestContext.<anonymous> (file:///C:/projects/robohub/app/src/usbStatus.test.ts:17:10)
```

`app/src/usbStatus.ts`'s `isUsbSerialDevicePresent()` returns `false` immediately on any platform other than macOS (`process.platform !== "darwin"`), by design. The failing test (`usbStatus.test.ts:13`) doesn't mock `process.platform` to `"darwin"` before asserting a `true` result, unlike the sibling test at line 31 ("returns false on non-macOS platforms...") which does mock the platform. On this Windows dev machine, the unmocked test hits the platform guard and gets `false`, failing the assertion. This is a pre-existing gap in the test itself (not the production code), unrelated to this plan's Pan-rename / discrete-rotate-buttons feature work — no diff line touches `usbStatus.ts` or `usbStatus.test.ts`.

## Overall verdict: FAIL (round 1)

Spec-match and security are both clean, but the unit/integration test gate failed. Per the review gate's rules, every applicable step-4 check must pass for the round to PASS, with no carve-out for pre-existing/environment-specific failures — so this round fails and a fix ticket is written.
