# Requirements: QD005 Aim Controls

## Problem

The QD005 water gun servo (GPIO 26, device code 0x02) controls the gun's vertical aim (up/down). The app already implements full end-to-end control of this servo, but it is incorrectly labeled throughout the codebase as "Pan Left/Right"—a leftover from an earlier, mistaken assumption about the servo's physical motion. The actual hardware motion is vertical (up and down), not horizontal.

Additionally, the QD005's controls (aim servo and separate shoot/blaster trigger, device code 0x08) are currently scattered as flat, undifferentiated `<div>`s in the single-page UI, mixed visually with the car's own Movement and Lights controls with no visual grouping that signals "these are the water-gun attachment's controls."

## Solution

### 1. Rename (not a new feature)
GPIO 26 / device code 0x02 is the one and only app-reachable axis for "up and down" — there is no second reachable servo. This is a pure identifier/label rename: "Pan"→"Aim", "Left/Right"→"Up/Down", across every layer (protocol comment, UI-state mapper, IPC channel constant/name, preload bridge, main-process wiring, IPC handler/validation, connection class method, renderer DOM/state logic, HTML markup/ids/CSS, and all corresponding test files). Zero changes to wire protocol, frame bytes, gating/rejection behavior, or angle bounds (still integer 1–180).

### 2. Direction sign (unverified placeholder)
- Up = increases the servo angle toward 180
- Down = decreases toward 1

This direction is explicitly unverified pending hardware calibration. It must be flagged in a code comment as unverified, mirroring how the prior "Pan" implementation flagged its own direction-sign constant. Easy to flip later (single delta-map constant).

### 3. New UI grouping
Introduce a `<section>` (or similar semantic wrapper) titled "QD005 Water Gun" that visually boxes together the (renamed) Aim Up/Down controls and the existing Shoot controls (button + cooldown toggle). Use bordered/boxed styling similar to the app's existing `.log-panel-container` box pattern (border, heading, contained group) used for the Wi-Fi/USB log panels.

### 4. Placement
The new QD005 section stays in the same page position the two divs occupy today—after `#movement-controls`, before `#log-panels`. No reordering of the rest of the page.

### 5. Button glyphs
Aim buttons use ▲ Up / ▼ Down — reusing the exact same triangle glyphs (`&#9650;` / `&#9660;`) already used by the D-pad's `#move-forward`/`#move-backward` buttons, for visual consistency (previously the Pan buttons used ◀/▶ `&#9664;`/`&#9654;`).

## What done looks like

- The full Pan→Aim rename is applied consistently across: `app/src/commandFrame.ts`, `app/src/connectionUiState.ts` (+ its test file), `app/src/ipcChannels.ts`, `app/src/preload.ts`, `app/src/main.ts`, `app/src/carIpcHandlers.ts` (+ its test file), `app/src/carConnection.ts` (+ its test file), `app/src/renderer.ts`, `app/public/index.html`.
- The new boxed "QD005 Water Gun" section renders in the app, grouping Aim + Shoot controls, in the same page position as today.
- `npm test`, `npm run typecheck`, and `npm run build` all pass cleanly inside `app/`.

## Explicitly out of scope

- No new protocol/device codes, no wire-format changes.
- No changes to Movement/Lights/Shoot *behavior* — Shoot's container is regrouped but its logic/handlers are untouched.
- No touching the firmware's internal GPIO 25 servo — it has no protocol device code and is unreachable from the app; not part of this work.
- No verifying the true physical up/down direction against real hardware — that's deferred, the placeholder sign is accepted as-is for now.

## Environment notes

### Current HTML structure (as of this interview)
The `app/public/index.html` has these top-level control divs in order:
- `#light-controls`
- `#movement-controls` (containing `.dpad-cross`, `.dpad-rotate-row`, `.dpad-discrete-rotate-row`)
- `#pan-controls` (buttons `#pan-left-button`/`#pan-right-button`, `#pan-speed-select`, `#pan-angle-text`)
- `#shoot-controls` (`#shoot-button`, `#shoot-cooldown-toggle-label`/`#shoot-cooldown-toggle`)
- `#log-panels` (two `.log-panel-container` boxes: Wi-Fi Log, USB Log)

### Existing visual pattern
The app's only existing "boxed" visual pattern is `.log-panel-container` (CSS: `flex: 1 1 20rem; min-width: 20rem;` with an `h2` heading, `.log-panel` having `border: 1px solid #ccc; border-radius: 4px;`).

### Button glyphs
- D-pad forward/backward buttons use HTML entities `&#9650;` (▲) and `&#9660;` (▼)
- Pan's old Left/Right buttons use `&#9664;` (◀) and `&#9654;` (▶)

### Full identifier inventory for the "Pan" rename

**app/src/commandFrame.ts**
- Doc comment on `DEVICE_SERVO = 0x02` says "pan servo" → "aim servo"

**app/src/connectionUiState.ts**
- `MIN_PAN_ANGLE`/`MAX_PAN_ANGLE` → `MIN_AIM_ANGLE`/`MAX_AIM_ANGLE`
- `PanControlUiState` interface (`leftDisabled`/`rightDisabled`) → `AimControlUiState` (`upDisabled`/`downDisabled`)
- `mapPanControlUiState()` → `mapAimControlUiState()`

**app/src/connectionUiState.test.ts**
- All matching test names/assertions

**app/src/ipcChannels.ts**
- `CAR_SET_PAN_ANGLE_CHANNEL = "car:set-pan-angle"` → `CAR_SET_AIM_ANGLE_CHANNEL = "car:set-aim-angle"`

**app/src/preload.ts**
- Inlined channel constant (hand-copied from ipcChannels.ts)
- `CarApi.setPanAngle` → `setAimAngle` (interface member, doc comment, and implementation)

**app/src/main.ts**
- Import + `ipcMain.handle(CAR_SET_PAN_ANGLE_CHANNEL, ...)` → `CAR_SET_AIM_ANGLE_CHANNEL`/`handleSetAimAngle`

**app/src/carIpcHandlers.ts**
- `CarConnectionLike.setPanAngle` → `setAimAngle`
- `CarIpcHandlers.handleSetPanAngle` → `handleSetAimAngle`
- `MIN_PAN_ANGLE`/`MAX_PAN_ANGLE` → `MIN_AIM_ANGLE`/`MAX_AIM_ANGLE`
- `isValidPanAngle()` → `isValidAimAngle()`
- Doc comments updated

**app/src/carIpcHandlers.test.ts**
- `FakeCarConnection.setPanAngleCalls`/`setPanAngleImpl`, constructor option `onSetPanAngle`, method `setPanAngle()` → all Aim equivalents
- `VALID_PAN_ANGLES`/`INVALID_PAN_ANGLES` → `VALID_AIM_ANGLES`/`INVALID_AIM_ANGLES`
- All test names/assertions/regexes (`/Invalid pan angle/` → `/Invalid aim angle/`)

**app/src/carConnection.ts**
- Doc comment "QD005 pan servo" → "QD005 aim servo"
- `async setPanAngle(angle)` → `async setAimAngle(angle)` (body unchanged)

**app/src/carConnection.test.ts**
- Test names (e.g. ``setPanAngle(${angle}) writes the exact ADR-001 servo frame...``)
- All `connection.setPanAngle(...)` calls
- Trailing comment referencing `setPanAngle()` → all renamed to Aim equivalents

**app/src/renderer.ts** (largest surface — full DOM-wiring layer)
- Import `mapPanControlUiState`→`mapAimControlUiState`
- `CarApi.setPanAngle`→`setAimAngle`
- `type PanDirection = "left"|"right"`→`type AimDirection = "up"|"down"`
- `PAN_REPEAT_INTERVAL_MS`→`AIM_REPEAT_INTERVAL_MS`
- `PAN_STEP_DEGREES`→`AIM_STEP_DEGREES`
- `MIN_PAN_ANGLE`/`MAX_PAN_ANGLE`→`MIN_AIM_ANGLE`/`MAX_AIM_ANGLE`
- `let panAngle = 90`→`let aimAngle = 90`
- `panSpeed`→`aimSpeed`
- `panHoldDirection`→`aimHoldDirection`
- `panRepeatTimer`→`aimRepeatTimer`
- `function renderPan(state)`→`renderAim(state)` (DOM ids `pan-left-button`/`pan-right-button`/`pan-angle-text`→`aim-up-button`/`aim-down-button`/`aim-angle-text`, label text `Pan: ${panAngle}°`→`Aim: ${aimAngle}°`)
- `render()` call site
- `PAN_ANGLE_DELTA: Record<PanDirection,1|-1> = {left:1,right:-1}`→`AIM_ANGLE_DELTA: Record<AimDirection,1|-1> = {up:1,down:-1}` (same numeric values)
- `function stepPan()`→`stepAim()` (calls `window.carAPI.setAimAngle(aimAngle)`)
- `handlePanPointerDown`→`handleAimPointerDown`
- `handlePanRelease`→`handleAimRelease`
- `stopActivePan`→`stopActiveAim`
- `handlePanSpeedChange`→`handleAimSpeedChange`
- `PAN_BUTTON_IDS: Record<PanDirection,string> = {left:"pan-left-button",right:"pan-right-button"}`→`AIM_BUTTON_IDS = {up:"aim-up-button",down:"aim-down-button"}`
- Event-listener wiring loop and `pan-speed-select`→`aim-speed-select` id
- `window.addEventListener("blur", ...)` calling `stopActivePan()`→`stopActiveAim()`
- `onStatus` reset blocks (`panAngle = 90; ... stopActivePan();`)→`aimAngle = 90; ... stopActiveAim();`
- Assorted comments mentioning "pan"/"Pan" for consistency

**app/public/index.html**
- Rename all `pan-*` ids/CSS selectors to `aim-*` (`#pan-controls`→new section wrapper, `#aim-up-button`, `#aim-down-button`, `#aim-speed-select`, `#aim-angle-text`)
- Button glyphs `&#9664; Left`/`&#9654; Right`→`&#9650; Up`/`&#9660; Down`
- Label text `Pan: 90°`→`Aim: 90°`
- CSS rules for `#pan-controls`, `#pan-left-button, #pan-right-button`, `#pan-left-button:disabled, #pan-right-button:disabled`, `#pan-speed-select`, `#pan-angle-text` renamed to `aim-*` equivalents
- Brand-new "QD005 Water Gun" boxed section wrapper (new CSS class, e.g. `.qd005-section` with border/padding/heading, similar to `.log-panel-container`) containing the renamed Aim controls and the existing (untouched-logic) Shoot controls
