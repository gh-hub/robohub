# Requirements: Distance Sensor Pan Control

## Problem

The QD001 base car has its own GPIO 25 servo (labeled `fixedServo` in the vendor firmware, physically mounted on the ultrasonic distance-sensor bracket) that pans the sensor left and right. This servo is driven only by the firmware's internal obstacle-avoidance logic (`model2_func()` in the `.ino` source) and has **no protocol device code** — it is completely unreachable from the app today.

Additionally, there is no UI control or app-side protocol pathway to remotely command this servo's angle, even if future firmware work adds support. The app should provide the full infrastructure (IPC channel, CarConnection method, renderer UI, protocol constant) so that when firmware support is eventually added, the app can immediately exercise it without redoing this layer.

## Solution

### 1. App-side protocol and IPC plumbing (firmware support deferred)
Add a new device code placeholder (`0x04`) and full end-to-end app control pathway (IPC channel, CarConnection method, main-process handler, preload bridge, renderer DOM/state) that mirrors the existing Aim servo pattern exactly. The app will send Left/Right commands to the car, but the firmware today has no handler for this device code—so the commands will be silently ignored by the car until a future, separate effort adds firmware support and reflashes the ESP32.

### 2. Naming: "distance sensor"
All identifiers use "distance sensor" as the control name, referring to what is being panned (the ultrasonic sensor bracket), not the motion ("pan") or the firmware's internal variable name ("fixedServo"). This is symmetric with how GPIO 26 is named "aim" for what it does (aims the water gun), per the user's preference.

### 3. New UI section with boxed visual treatment
Introduce a `<section>` titled "Distance Sensor" (not grouped under the QD005 section, since this is the base car's own hardware). The section contains Left/Right buttons (`◀` / `▶`, reusing glyphs freed from the old Pan Left/Right control in the sibling plan), Speed selector (Fast/Slow), and live angle readout (`Distance Sensor: {angle}°`). Use the same bordered/boxed visual pattern the sibling plan is establishing (via generalized `.boxed-section` CSS class).

### 4. Placement
The new Distance Sensor section is positioned immediately after `#movement-controls`, before the QD005 Water Gun section (i.e., **before** the sibling plan's new `<section class="boxed-section">` for QD005). This keeps base-car controls (Movement, Lights, Distance Sensor) visually grouped before attachment-specific controls (QD005 Water Gun).

### 5. Direction sign (unverified placeholder)
- Left = decreases the servo angle toward 1
- Right = increases toward 180

This direction is unverified pending hardware calibration and real motion verification. Must be flagged in code comments as unverified, mirroring the Aim control's own placeholder pattern.

### 6. Interaction pattern: exact mirror of Aim
- Hold-to-repeat at 400ms cadence (`DISTANCE_SENSOR_REPEAT_INTERVAL_MS = 400`)
- Fast/Slow speed selector with 10°/5° degree steps (`DISTANCE_SENSOR_STEP_DEGREES = {fast:10, slow:5}`)
- Angle bounds: 1–180° (same as Aim, not narrowed to the firmware's own 45–135° obstacle-avoidance range)
- Live angle readout text updates on every command
- Resets to 90° on every connect/disconnect/error transition (same reset points as `aimAngle`)
- Direction-sign delta map flagged as unverified pending calibration (same pattern as Aim's `AIM_ANGLE_DELTA`)

### 7. CSS refactoring (shared with sibling plan)
Rename the CSS class the sibling plan defines, `.qd005-section` → `.boxed-section`, in both `app/public/index.html`'s `<style>` block and on the QD005 section's opening tag. Both the QD005 Water Gun section and this plan's new Distance Sensor section then use `class="boxed-section"`. This is a deliberate edit to a file the sibling plan also touches (that plan is mid-review)—implementer should check for conflicts and re-run its tests.

## What done looks like

- A new `DEVICE_DISTANCE_SENSOR = 0x04` constant in `app/src/commandFrame.ts` with code comment flagging it as firmware-unhandled and referencing this plan.
- New IPC channel constant `CAR_SET_DISTANCE_SENSOR_ANGLE_CHANNEL = "car:set-distance-sensor-angle"` (ipcChannels.ts, preload.ts).
- New `CarConnection.setDistanceSensorAngle()` method (carConnection.ts) constructing the command frame with device `0x04` and action `CMD_RUN`.
- New IPC handler `handleSetDistanceSensorAngle()` with validation function `isValidDistanceSensorAngle()` (carIpcHandlers.ts).
- New preload bridge method `CarApi.setDistanceSensorAngle()` (preload.ts).
- New renderer functions `renderDistanceSensor()`, `stepDistanceSensor()`, event handlers `handleDistanceSensorPointerDown/Release`, `stopActiveDistanceSensor`, `handleDistanceSensorSpeedChange`, and supporting state (`distanceSensorAngle`, `distanceSensorSpeed`, `distanceSensorHoldDirection`, `distanceSensorRepeatTimer`) (renderer.ts).
- New renderer UI state mapper `mapDistanceSensorControlUiState()` and interface `DistanceSensorControlUiState` (connectionUiState.ts).
- New HTML section `<section class="boxed-section">` titled "Distance Sensor" with buttons `#distance-sensor-left-button` / `#distance-sensor-right-button`, selector `#distance-sensor-speed-select`, text `#distance-sensor-angle-text`, and supporting CSS rules (index.html).
- CSS class `.qd005-section` renamed to `.boxed-section` on both the QD005 section and in the CSS rules (index.html).
- Test coverage mirroring Aim's pattern: `mapDistanceSensorControlUiState()` suite (connectionUiState.test.ts), `handleSetDistanceSensorAngle()` + `isValidDistanceSensorAngle()` tests (carIpcHandlers.test.ts), frame-construction test for `setDistanceSensorAngle()` (carConnection.test.ts).
- `npm test`, `npm run typecheck`, and `npm run build` all pass cleanly inside `app/`.

## Explicitly out of scope

- No changes to the vendor `.ino` firmware source — GPIO 25 / `fixedServo` continues to be driven only by firmware's own obstacle-avoidance code.
- No reflashing of the physical ESP32 — the firmware has no `runModule()` handler for device code `0x04` today, so app commands will be silently ignored until separate firmware work adds support.
- No verification that Left/Right actually correspond to correct physical directions — hardware calibration is deferred, the placeholder sign is accepted as-is for now.
- No new DOM/UI test harness — mirrors the codebase's existing testing posture (verified via `npm run build`/`npm run typecheck` + manual inspection only).
- No narrowing of angle bounds to the firmware's internal 45–135° obstacle-avoidance range — kept at 1–180° for consistency with Aim.

## Environment notes

### Pin mapping
- GPIO 25 = QD001 base car's steering/distance-sensor servo (labeled "Servo" header, port 25, one of 3 available servo channels 25/26/27 on the QA052 shield).
- GPIO 26 = QD005 aim servo (already app-reachable, device code `0x02`).

### Firmware ground truth
Confirmed device codes currently handled by `runModule()`/the firmware's command dispatch (from `ACB_CAR_ARM.cpp` protocol reference):
- `0x02` (aim/turn servo)
- `0x03` (buzzer)
- `0x05` (LED)
- `0x08` (shoot)
- `0x0C` (motor)
- `0x0D` (speed)
- `0x1E`–`0x28` (vision/camera, QD002/QD003 only)
- `0x29`–`0x2B` (RGB LED strip)

GPIO 25 / `fixedServo` is **not** in this list and has no device-code handler.

### Vendor `.ino` behavior
From `acebott-esp32-car-body.ino` (vendor source under `docs/`):
- `fixedServo` (GPIO 25) is written directly (`fixedServo.write(angle)`, no `map()` transform) only from:
  - `model2_func()`: obstacle-avoidance sweep, samples 90°, then 45°/135° left/right to measure distances
  - `CMD_STANDBY` case in `parseData()`: resets to 90°
- Never driven by an app-issued `runModule()` device-code command—confirming it is unreachable from the app today.

### Flash pipeline
This repo has no firmware build/flash pipeline in the codebase. The `.ino` above is a read-only vendor reference copy under `docs/`; the actual running firmware is a compiled binary on the physical ESP32. A full flash backup exists at `backups/car-flash-backup-2026-08-20.bin`. Reflashing is a manual, physical, out-of-band step performed outside this repo.

### Current HTML structure
The `app/public/index.html` has these top-level control sections in order (as of this interview):
- `#light-controls`
- `#movement-controls` (`.dpad-cross`, `.dpad-rotate-row`, `.dpad-discrete-rotate-row`)
- (This plan's new) `#distance-sensor-controls` (new section, placed here after Movement)
- `<section class="boxed-section">` (QD005 Water Gun, from sibling plan, containing `#aim-controls` and `#shoot-controls`)
- `#log-panels`

### Existing Aim pattern reference
This plan mirrors the Aim servo pattern exactly. Key file/identifier references:
- `app/src/renderer.ts`: `renderAim()`, `stepAim()`, `handleAimPointerDown/Release`, `stopActiveAim`, `handleAimSpeedChange`, `AIM_REPEAT_INTERVAL_MS=400`, `AIM_STEP_DEGREES={fast:10,slow:5}`, `MIN_AIM_ANGLE=1`, `MAX_AIM_ANGLE=180`, `AIM_ANGLE_DELTA`, `aimAngle`, `aimSpeed`, `aimHoldDirection`, `aimRepeatTimer`
- `app/src/connectionUiState.ts`: `mapAimControlUiState()`, `AimControlUiState{upDisabled,downDisabled}`
- `app/src/carIpcHandlers.ts`: `handleSetAimAngle()`, `isValidAimAngle()`
- `app/src/carConnection.ts`: `setAimAngle()`
- `app/src/ipcChannels.ts`: `CAR_SET_AIM_ANGLE_CHANNEL = "car:set-aim-angle"`
- `app/src/preload.ts`: `CarApi.setAimAngle()`
- `app/src/commandFrame.ts`: `DEVICE_SERVO = 0x02`

All of the above identifiers are replicated for Distance Sensor, with `aim`→`distanceSensor`, `AIM`→`DISTANCE_SENSOR`, `Aim`→`DistanceSensor`, and direction-specific constants (`upDisabled`/`downDisabled`→`leftDisabled`/`rightDisabled`).

### Button glyphs
- Old Pan Left/Right buttons used `&#9664;` (◀) and `&#9654;` (▶).
- Aim Up/Down buttons (from sibling plan) use `&#9650;` (▲) and `&#9660;` (▼).
- D-pad's own left/right buttons also use `&#9664;` (◀) and `&#9654;` (▶).
- This plan's Distance Sensor buttons reuse the freed ◀/▶ glyphs (`&#9664;` / `&#9654;`) since they drive horizontal left/right motion.
