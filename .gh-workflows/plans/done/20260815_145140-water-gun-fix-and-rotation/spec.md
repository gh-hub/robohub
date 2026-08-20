# Spec: water-gun-fix-and-rotation

## Problem Statement

Hardware testing of the QD005 water-gun attachment surfaced three issues in the Electron control app (`app/src/`):

1. The "Aim Up/Down" servo buttons are mislabeled: on this physical build, the single controllable servo (GPIO 26 / device `0x02`) is mounted to pan the ultrasonic distance sensor bracket left/right, not to tilt a gun barrel up/down. The UI's up/down framing doesn't match what the hardware actually does, which is confusing when using the app.
2. Clicking "Shoot" produces no physical effect at all — no motion, sound, or response from the blaster.
3. Users want quick one-click 90°/180° left/right rotation, rather than only the existing hold-to-rotate D-pad buttons.

## Solution

**Pan rename (Issue #1):** Repurpose the existing Aim Up/Down control end-to-end as Pan Left/Right, per [ADR-001](grill/ADR-001.md). This is a pure rename across types, identifiers, labels, HTML ids, and tests — the underlying servo protocol command, bounds, speeds, and repeat logic are unchanged, because there is no second servo channel in the firmware protocol to add a "real" tilt axis.

**Shoot diagnosis (Issue #2):** No code changes. `DEVICE_SHOOT = 0x08` already matches the firmware's expected pulse byte-for-byte, and `mapShootControlUiState()`'s gating is independently confirmed correct (see [decisions.md](grill/decisions.md) D3). This is a hardware fault (wiring, blaster motor/pump, or the unidentified `U4` driver chip on the QA052 shield near the Shoot JST connector) — outside what a code change can fix. This spec documents the finding; no ticket is needed for it.

**Discrete rotate buttons (Issue #3):** Add four new one-click buttons — Rotate 90°/180° Left/Right — per [ADR-002](grill/ADR-002.md). The firmware protocol has no angle-based rotate primitive, only continuous spin-until-stop (`rotate-left`/`rotate-right`, values `0x09`/`0x0a`, already defined in `MOVEMENT_VALUES`). Each new button sends the existing rotate command, waits a fixed placeholder duration, then sends Stop — reusing the protocol layer completely unchanged, with no new device/action codes.

## User Stories

1. As a user panning the sensor bracket, I want the buttons labeled "Pan Left"/"Pan Right" instead of "Aim Up"/"Aim Down", so that the UI matches what actually happens on my physical car.
2. As a user, I want the Pan buttons' press-and-hold, speed selection (Fast/Slow), angle bounds (1-180°), and connection gating to behave exactly as the old Aim buttons did, so that repurposing the control doesn't regress functionality I already rely on.
3. As a user whose Shoot button doesn't fire, I want a clear diagnosis of why (hardware, not software) and guidance on where to look, so that I know this isn't something waiting on an app update.
4. As a user, I want four new buttons — Rotate 90° Left, Rotate 90° Right, Rotate 180° Left, Rotate 180° Right — so that I can turn the car a roughly fixed amount with one click instead of eyeballing a hold-to-rotate press.
5. As a user, I want a discrete rotate click to immediately override anything else the D-pad is currently doing (a held movement or continuous rotate), so that the discrete rotate is predictable and always wins when clicked.
6. As a user, I want all movement and rotation buttons (continuous D-pad and discrete) disabled for the duration of a discrete rotate's timed pulse, so that I can't stack conflicting commands mid-turn.
7. As a developer, I want the rotate durations (400ms/800ms) clearly commented as unverified placeholders pending hardware calibration, so that a future contributor knows exactly what to tune and why, following the existing `AIM_ANGLE_DELTA`-style precedent in this codebase.
8. As a developer reviewing the diff, I want the Pan rename to be mechanically complete and consistent (types, state vars, constants, function names, HTML ids, label text, and tests) with no leftover "aim"/"up"/"down" naming, so that the codebase doesn't carry stale vocabulary that no longer matches the hardware.

## Implementation Decisions

### Pan rename (ADR-001)

- All renames are as scoped in [ADR-001](grill/ADR-001.md) and confirmed against the current source:
  - `app/src/renderer.ts`: `AimDirection` (`"up"|"down"` → `"left"|"right"`), `AIM_ANGLE_DELTA` → `PAN_ANGLE_DELTA`, `AIM_BUTTON_IDS` → `PAN_BUTTON_IDS`, `aimAngle`/`aimSpeed`/`aimHoldDirection`/`aimRepeatTimer` → `panAngle`/`panSpeed`/`panHoldDirection`/`panRepeatTimer`, `AIM_REPEAT_INTERVAL_MS` → `PAN_REPEAT_INTERVAL_MS`, `AIM_STEP_DEGREES` → `PAN_STEP_DEGREES`, `MIN_AIM_ANGLE`/`MAX_AIM_ANGLE` → `MIN_PAN_ANGLE`/`MAX_PAN_ANGLE`, and the function set `stepAim`/`handleAimPointerDown`/`handleAimRelease`/`stopActiveAim`/`renderAim`/`handleAimSpeedChange` → `stepPan`/`handlePanPointerDown`/`handlePanRelease`/`stopActivePan`/`renderPan`/`handlePanSpeedChange`.
  - `app/src/connectionUiState.ts`: `mapAimControlUiState()` → `mapPanControlUiState()`; its return shape `{ upDisabled, downDisabled }` → `{ leftDisabled, rightDisabled }`; internal constants `MIN_AIM_ANGLE`/`MAX_AIM_ANGLE` → `MIN_PAN_ANGLE`/`MAX_PAN_ANGLE`.
  - `app/public/index.html`: `#aim-controls` → `#pan-controls`, `#aim-up-button`/`#aim-down-button` → `#pan-left-button`/`#pan-right-button`, `#aim-speed-select` → `#pan-speed-select`, `#aim-angle-text` → `#pan-angle-text`, visible label "Aim: 90°" → "Pan: 90°", button glyphs/text "▲ Up"/"▼ Down" → left/right equivalents (e.g. "◀ Left"/"▶ Right", matching the existing D-pad's `&#9664;`/`&#9654;` glyph convention already used for `#move-left`/`#move-right`). CSS selectors referencing the old ids (`#aim-controls`, `#aim-up-button`, `#aim-down-button`, `#aim-speed-select`, `#aim-angle-text`) get the same rename.
  - **Resolved (user approved at the tickets checkpoint, 2026-08-15):** `window.carAPI.setAimAngle` **is** renamed to `setPanAngle`, for full naming consistency top to bottom. This extends the rename into `preload.ts` (the `CarApi`/`declare global` surface and its `renderer.ts`-local re-declared copy), `main.ts` (the `ipcMain.handle` wiring), `ipcChannels.ts` (the channel constant, if named after "aim"), and `carIpcHandlers.ts` (`handleSetAimAngle` → `handleSetPanAngle`, `isValidAimAngle` → `isValidPanAngle`), plus their existing tests (`carIpcHandlers.test.ts`). The underlying IPC channel string value itself may stay unchanged if it's not user-visible (only the TypeScript identifier matters for consistency) — implementer's call. No behavior change, mechanical rename only, folded into the Pan rename ticket.
- No behavior changes: same `DEVICE_SERVO = 0x02` command, same 1-180° bounds, same Fast(10°)/Slow(5°) steps, same 400ms repeat interval, same connection gating predicate (`connected && tcp100`), same "reset to 90° on connect/disconnect/error" behavior in the `onStatus` handler in `renderer.ts`.
- `AimDirection`'s new `"left"|"right"` values are a distinct type from `MovementDirection`'s `"left"|"right"` (D-pad strafe) — same string values, unrelated types, no collision risk since they're never passed to each other's functions.

### Discrete rotate buttons (ADR-002)

- New constants in `app/src/renderer.ts`: `ROTATE_90_MS = 400`, `ROTATE_180_MS = 800`, explicitly commented as unverified placeholders pending hardware calibration (matching the existing `AIM_ANGLE_DELTA`/`PAN_ANGLE_DELTA` commenting precedent already in the file).
- New state var `rotateCooldownActive` (boolean), mirroring the existing `shootCooldownActive` pattern — but unlike Shoot's cooldown (which only disables the Shoot button), this disables every movement and rotate button: the four D-pad direction buttons, the two continuous rotate buttons (`#rotate-left`/`#rotate-right`), and the four new discrete rotate buttons.
- New handler `handleDiscreteRotate(direction: "left" | "right", angleDegrees: 90 | 180)`:
  1. Calls the existing `stopActiveMovement()` to interrupt any held D-pad direction/continuous rotate first (per decisions.md D4 and user story 5).
  2. Sets `rotateCooldownActive = true` and re-renders movement/rotate button disabled state.
  3. Sends the existing `rotate-left`/`rotate-right` movement command via `sendMovement()` (same function the D-pad already uses — no new IPC call).
  4. After `ROTATE_90_MS`/`ROTATE_180_MS` (via `setTimeout`), sends `sendMovement("stop")`, sets `rotateCooldownActive = false`, and re-renders.
- `renderMovement()` (or an equivalent combined render path) must fold `rotateCooldownActive` into every movement/rotate button's `disabled` state, same pattern as `renderShoot()` folding in `shootCooldownActive` alongside `mapMovementControlUiState()`'s connection-based `disabled`. This is a DOM-wiring-layer concern only — `mapMovementControlUiState()` itself stays a pure connection-state mapping, unchanged.
- New HTML ids in `app/public/index.html`: `#rotate-90-left-button`, `#rotate-90-right-button`, `#rotate-180-left-button`, `#rotate-180-right-button`, placed in a new `.dpad-discrete-rotate-row` below the existing `.dpad-rotate-row`, following the same button/CSS styling convention as the continuous rotate row.
- No new device/action/movement codes: reuses `MOVEMENT_VALUES["rotate-left"]`/`["rotate-right"]` (`0x09`/`0x0a`) and the existing `"stop"` value, already defined in `commandFrame.ts`. No changes needed to `commandFrame.ts`, `carConnection.ts`, or `carIpcHandlers.ts` — the entire feature is renderer-side composition of the already-tested `setMovement` IPC call.
- The connection-drop safety net in `renderer.ts`'s `window.carAPI.onStatus` handler (which currently clears `activeDirection` via `clearActiveMovement()` when leaving `connected`+`tcp100`) must also clear any in-flight discrete-rotate cooldown/timer, so a mid-pulse disconnect doesn't leave buttons stuck disabled or a stale `setTimeout` firing a doomed Stop call later.
- `window.addEventListener("blur", ...)`, which already calls `stopActiveMovement()`/`stopActivePan()`, should also cancel any in-flight discrete-rotate timer and clear `rotateCooldownActive`, for the same "alt-tab away mid-action" safety-net reasoning already documented for movement/pan.

### Shoot diagnosis (no code changes)

- No modules touched. The diagnosis (D3 in decisions.md) is documented in this plan's `grill/` output and repeated here for completeness: `DEVICE_SHOOT = 0x08` matches firmware exactly; `mapShootControlUiState()` gating is correct; the fault is hardware (wiring / blaster motor-pump / `U4` driver chip on the QA052 shield). No ticket, no code change.

## Testing Decisions

Existing test seams in this codebase, reused as-is (no new test infrastructure introduced):

- **Pure state-mapping functions in `connectionUiState.ts`** are unit-tested directly in `connectionUiState.test.ts` (input/output pairs over `ConnectionState` + local args, no DOM, no fakes). `mapPanControlUiState()` (renamed from `mapAimControlUiState()`) follows this exact existing pattern — the current `connectionUiState.test.ts` already has a full suite of angle-bound/connection-state cases for the old `upDisabled`/`downDisabled` shape (lines ~155-186) that need renaming to `leftDisabled`/`rightDisabled` with equivalent bound assertions (left ↔ old up-at-180-disabled semantics preserved exactly, since only the label direction changes, not which bound disables which button — confirm the up→left / down→right mapping is preserved 1:1, not flipped, since ADR-001 states mechanics are unchanged).
- **`carIpcHandlers.ts`/`carConnection.ts` are tested via a `CarConnectionLike`/`FakeCarConnection` fake** (`carIpcHandlers.test.ts`, `carConnection.test.ts`). No changes needed here for either the Pan rename (IPC method name `setAimAngle` is unchanged, per the Implementation Decisions note above) or the discrete rotate buttons (they compose the already-existing, already-parametrized-over-`rotate-left`/`rotate-right` `handleSetMovement` tests in `carIpcHandlers.test.ts` — no new IPC surface is added, so no new IPC-layer tests are needed).
- **`renderer.ts` (DOM wiring) is not currently unit-tested directly** — confirmed: no `renderer.test.ts` exists in `app/src/`. This spec follows that existing precedent rather than introducing new DOM-testing infrastructure (e.g. jsdom) for either the Pan rename's renderer-side wiring or the new discrete-rotate handler/cooldown logic. The renderer-side pieces (interrupt semantics, cooldown disable/enable, timed pulse sequencing) are exercised manually, same as the existing Shoot cooldown and movement D-pad interrupt logic are today.
- No new test seams are proposed. If the discrete-rotate cooldown/interrupt logic in `renderer.ts` grows complex enough to want direct testing, that would be a pre-existing gap (renderer.ts as a whole is untested), not something specific to this feature — out of scope to fix here.

## Out of Scope

- No firmware/ESP32 `.ino` changes (reference-only, per requirements.md).
- No hardware repair for the Shoot mechanism — diagnosis and documentation only, no ticket.
- No new/second servo channel or "true" up/down gun-aim axis — only one servo is reachable via the protocol.
- Rotation angle accuracy: the 400ms/800ms durations are placeholders; real-world accuracy depends on motor speed/battery/friction and requires physical hardware calibration post-ship, not part of this plan's Done Criteria.
- Renaming `window.carAPI.setAimAngle` (the IPC method/channel name) — stays as-is; see Implementation Decisions note.
- No new automated test infrastructure for `renderer.ts` DOM wiring (jsdom or similar) — follows existing precedent of leaving `renderer.ts` untested directly.

## Further Notes

- **Resolved — IPC method naming:** User approved renaming `setAimAngle` → `setPanAngle` throughout (`preload.ts`, `main.ts`, `ipcChannels.ts`, `carIpcHandlers.ts`, and tests), extending ADR-001's scope beyond the originally-listed `renderer.ts`/`connectionUiState.ts`/`index.html` files for full naming consistency. See Implementation Decisions above.
- **Rotate cooldown interaction with Pan controls:** ADR-002 and decisions.md D4 only mention disabling "movement and rotation buttons" during a discrete-rotate pulse — Pan/servo buttons are a separate device (`DEVICE_SERVO`, not `DEVICE_MOTOR`) and aren't mentioned as needing to be disabled during a rotate pulse. This spec does not disable Pan controls during rotate cooldown, consistent with that scoping (they're independent hardware channels and don't conflict at the protocol level). Flagged here in case that's an oversight in the original decision rather than an intentional choice.
- **Glyph/label choice for the renamed Pan buttons:** ADR-001 doesn't specify exact button text beyond "Pan: 90°" for the angle readout. This spec proposes left/right arrow glyphs matching the D-pad's existing convention (Implementation Decisions, Pan rename section) as a reasonable default; not a hard requirement, and the implementer can adjust cosmetically without a spec change.
