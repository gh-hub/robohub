# Implement notes: 02 — Discrete rotate buttons (90°/180° Left/Right)

## What was built

Four new one-click discrete-rotate buttons — Rotate 90° Left, Rotate 90° Right, Rotate 180° Left,
Rotate 180° Right — added alongside the existing continuous hold-to-rotate D-pad buttons
(`#rotate-left`/`#rotate-right`, unchanged). Each click sends a fixed-duration pulse of the
existing `rotate-left`/`rotate-right` movement command, then auto-stops. No new protocol/device/
IPC code — reuses `MOVEMENT_VALUES["rotate-left"]`/`["rotate-right"]` (`0x09`/`0x0a`, already
defined in `commandFrame.ts`) and the existing `setMovement`/`sendMovement` IPC path end to end.

Touched files:

- `app/src/renderer.ts`:
  - New constants `ROTATE_90_MS = 400` and `ROTATE_180_MS = 800`, commented as unverified
    placeholders pending hardware calibration (same precedent as `PAN_ANGLE_DELTA`).
  - New state: `rotateCooldownActive` (boolean, mirrors `shootCooldownActive`'s pattern but gates
    the *entire* movement/rotate button set, not just one button) and `discreteRotateTimer`
    (the in-flight `setTimeout` handle, or `null`).
  - New `DISCRETE_ROTATE_BUTTONS` array — single source of truth (id + direction + angleDegrees)
    used both by `renderMovement()`'s disabled-state loop and the click-listener wiring at the
    bottom of the file, avoiding a duplicate id list.
  - New `handleDiscreteRotate(direction, angleDegrees)`: calls `stopActiveMovement()` first (interrupt
    semantics), sets `rotateCooldownActive = true` and re-renders, sends the rotate command via
    `sendMovement()`, then after `ROTATE_90_MS`/`ROTATE_180_MS` sends `sendMovement("stop")`, clears
    the cooldown, and re-renders.
  - New `stopActiveDiscreteRotate()` (used by the `blur` handler — connection still live, so it
    sends an explicit Stop and re-renders, mirroring `stopActiveMovement()`'s reasoning) and
    `clearDiscreteRotateCooldown()` (used by the `onStatus` connection-drop safety net — socket
    already gone, so it's a pure state reset with no Stop send, mirroring `clearActiveMovement()`'s
    reasoning; `render(state)` is called right after by the existing handler).
  - `renderMovement()` updated to fold `rotateCooldownActive` into every movement/rotate button's
    `disabled` state (the 4 D-pad buttons, 2 continuous-rotate buttons, and 4 new discrete-rotate
    buttons) — same composition pattern as `renderShoot()`/`shootCooldownActive`.
    `mapMovementControlUiState()` in `connectionUiState.ts` was left unchanged, confirmed still a
    pure connection-state-only mapping.
  - `window.carAPI.onStatus`'s existing connection-drop block extended with a
    `clearDiscreteRotateCooldown()` call alongside the existing `clearActiveMovement()`/
    `stopActivePan()` calls.
  - `window.addEventListener("blur", ...)` extended with a `stopActiveDiscreteRotate()` call
    alongside the existing `stopActiveMovement()`/`stopActivePan()` calls.
- `app/public/index.html`: four new buttons (`#rotate-90-left-button`, `#rotate-90-right-button`,
  `#rotate-180-left-button`, `#rotate-180-right-button`) in a new `.dpad-discrete-rotate-row` below
  `.dpad-rotate-row`, with matching CSS (same font-size/padding/cursor/disabled-opacity convention
  as the continuous-rotate row).
- No changes to `commandFrame.ts`, `carConnection.ts`, `carIpcHandlers.ts`, or
  `connectionUiState.ts` — confirmed `MOVEMENT_VALUES["rotate-left"]`/`["rotate-right"]` already
  exist (`0x09`/`0x0a`) and no new device/action/movement codes were introduced.

## Decisions / judgment calls

1. **Single `DISCRETE_ROTATE_BUTTONS` array instead of a separate id-only list.** The ticket
   describes both a disabled-state loop and click-wiring loop; rather than duplicating the four
   button ids in two places, one array of `{id, direction, angleDegrees}` feeds both, per the
   "no over-engineering"/duplication-avoidance general coding rule.
2. **Blur vs. connection-drop use two different cleanup functions, not one.** Mirrors the existing
   asymmetry already in the codebase between `stopActiveMovement()` (sends Stop — connection still
   live on blur) and `clearActiveMovement()` (no Stop — connection already gone on disconnect).
   Applied the same reasoning to the new discrete-rotate cleanup: `stopActiveDiscreteRotate()` for
   blur (sends Stop, re-renders immediately so buttons don't visibly stay disabled) and
   `clearDiscreteRotateCooldown()` for the `onStatus` connection-drop path (pure state reset, no
   pointless doomed IPC call; the existing handler's own `render(state)` call afterward covers the
   re-render).
3. **Manual/visual check left unperformed.** Attempted `npx electron .` directly in this session
   (no project-specific run/Playwright skill exists for this repo yet, and Playwright isn't a repo
   dependency). The process launched but logged GPU-process/network-service errors consistent with
   a headless/no-display environment, so no window content could be observed or clicked through.
   Setting up a full Playwright `_electron` driver was judged out of scope for this ticket — same
   call ticket 01 made for its own manual-check box. Left the box unchecked in the ticket file with
   this reasoning noted inline. **Recommend a follow-up** (possibly as part of review, or a small
   dedicated ticket) to set up Playwright per the coding rules' "UI verification" rule and manually
   verify both ticket 01's Pan-rename UI and ticket 02's new discrete-rotate buttons together, since
   neither has been visually confirmed yet.

## Test results

- `npm run typecheck` (`app/`): clean, zero errors.
- `npm run build` (`app/`): clean, both tsc projects (`tsconfig.build.json`, `tsconfig.renderer.json`)
  compile.
- `npm test` (`app/`): 148/149 passing. No new tests were added — per the ticket's own acceptance
  criterion, no new pure-logic helper was extracted that fits an existing test seam (everything
  added is DOM-wiring/timer orchestration in `renderer.ts`, which the codebase already leaves
  untested directly, matching ticket 01's precedent — no new test infrastructure like jsdom was
  introduced). The one failure — `isUsbSerialDevicePresent returns true when a cu.usbserial-*
  entry exists...` (`app/src/usbStatus.test.ts`) — is the same pre-existing, unrelated,
  macOS-only-code-path failure noted in ticket 01's notes and CONTEXT.md's gotchas; not touched by
  this ticket, out of scope to fix here.

## What the review phase needs to know

- **Both tickets are now implementation-complete**, but **neither has an actual manual/visual
  click-through verification** — ticket 01 (Pan rename) and ticket 02 (discrete rotate buttons)
  both left that acceptance box unchecked for the same reason: no Electron app/physical hardware
  session available, and Playwright isn't set up in this repo. Review should treat this as an open
  item, not assume it was silently verified.
- The pre-existing `usbStatus.test.ts` macOS-only test failure (148/149) is unrelated to both
  tickets and out of scope — do not treat it as a regression introduced by this plan.
- `ROTATE_90_MS`/`ROTATE_180_MS` (400ms/800ms) are explicitly unverified placeholders pending real
  hardware timing calibration, per ADR-002 — flagged in-code and here so review doesn't mistake
  them for calibrated values.
- No new gotchas surfaced beyond what ticket 01's notes/CONTEXT.md already flagged; `stopActivePan`
  and the `onStatus`/`blur` safety-net hooks were exactly where and shaped as ticket 01's handoff
  notes described, so ticket 02's extensions to those hooks were straightforward.
