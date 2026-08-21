## Problem Statement

The QD001 base car has its own GPIO 25 servo (the firmware's `fixedServo`, physically mounted on the ultrasonic distance-sensor bracket) that pans the sensor left and right. Today it is driven only by the firmware's internal obstacle-avoidance logic and has no protocol device code — it's completely unreachable from the app. There is no UI control and no app-side pathway (protocol constant, IPC channel, connection method) to command this servo's angle at all.

## Solution

Add a full app-side control pathway for this servo — protocol constant, `CarConnection` method, IPC channel, main-process wiring, preload bridge, renderer DOM/state, and a new UI section — that exactly mirrors the existing Aim Up/Down control (GPIO 26), just renamed for "distance sensor" and using Left/Right instead of Up/Down. The device code used (`0x04`) is an unverified placeholder: the firmware has no handler for it today, so sending this command has no physical effect until a separate, later effort adds firmware support and reflashes the car. This plan builds the app side only.

A new boxed `<section>` titled "Distance Sensor" is added to `app/public/index.html`, positioned right after `#movement-controls` and before the QD005 Water Gun section (a sibling in-progress plan) — grouping it with the base car's own controls (Movement, Lights) rather than the QD005 attachment. That sibling plan's `.qd005-section` CSS class is generalized to `.boxed-section` so both sections share the same bordered/heading box style.

## Implementation Decisions

- **Scope**: app-side only. No firmware `.ino` edits, no reflashing. `DEVICE_DISTANCE_SENSOR = 0x04` is flagged in a code comment as an unverified placeholder with no firmware handler, pointing back to this plan.
- **Naming**: "distance sensor" throughout — `DEVICE_DISTANCE_SENSOR`, `setDistanceSensorAngle()`, `CAR_SET_DISTANCE_SENSOR_ANGLE_CHANNEL = "car:set-distance-sensor-angle"`, `mapDistanceSensorControlUiState()`/`DistanceSensorControlUiState{leftDisabled,rightDisabled}`, renderer identifiers (`renderDistanceSensor`, `stepDistanceSensor`, `handleDistanceSensorPointerDown/Release`, `stopActiveDistanceSensor`, `handleDistanceSensorSpeedChange`, `DISTANCE_SENSOR_REPEAT_INTERVAL_MS`, `DISTANCE_SENSOR_STEP_DEGREES`, `MIN_DISTANCE_SENSOR_ANGLE`/`MAX_DISTANCE_SENSOR_ANGLE`, `DISTANCE_SENSOR_ANGLE_DELTA`, `distanceSensorAngle`/`Speed`/`HoldDirection`/`RepeatTimer`), HTML ids (`distance-sensor-left-button`, `distance-sensor-right-button`, `distance-sensor-speed-select`, `distance-sensor-angle-text`, `#distance-sensor-controls`).
- **Behavior**: exact mirror of the Aim control — 400ms hold-to-repeat, Fast/Slow dropdown (10°/5° steps), angle bounds 1–180 (same as Aim, not narrowed to the firmware's own 45–135° obstacle-avoidance range), resets to 90° on every connect/disconnect/error transition, direction-sign delta map (`{left: -1, right: 1}`) flagged unverified pending hardware calibration.
- **Glyphs**: ◀ Left / ▶ Right (`&#9664;`/`&#9654;`) — the glyphs freed by the sibling plan's Pan→Aim rename.
- **Placement**: new `<section class="boxed-section">` titled "Distance Sensor", after `#movement-controls`, before the QD005 Water Gun section.
- **CSS**: rename `.qd005-section` → `.boxed-section` (and its `h2` child selector) in `app/public/index.html`; both boxed sections use the generalized class. This touches a file the sibling plan (`20260820_104832-qd005-aim-controls`, currently mid-review) also owns — check that plan's state before editing, and re-run its tests if there's overlap.
- **IPC/validation**: `handleSetDistanceSensorAngle()` validates the angle is an integer in [1, 180] at the trust boundary, mirroring `handleSetAimAngle()`/`isValidAimAngle()` exactly.

## Testing Decisions

- Mirror the existing Aim test coverage exactly, same shape and bound cases:
  - `connectionUiState.test.ts` — `mapDistanceSensorControlUiState()` suite (gating + bound-edge cases, `leftDisabled`/`rightDisabled`).
  - `carIpcHandlers.test.ts` — `handleSetDistanceSensorAngle()` + angle-validation tests (valid/invalid angle sets, error message format).
  - `carConnection.test.ts` — `setDistanceSensorAngle()` frame-construction test (asserts exact bytes: device `0x04`, action `CMD_RUN`).
- No new DOM/UI test harness — consistent with this codebase's existing posture for `renderer.ts`/`index.html`; verified via `npm run build`/`npm run typecheck` plus manual inspection.
- Full acceptance bar: `npm test`, `npm run typecheck`, `npm run build` all pass cleanly inside `app/`.

## Out of Scope

- No vendor `.ino` firmware changes and no reflashing of the physical ESP32 — device code `0x04` has no firmware handler; commands are silently ignored by the car until a separate future effort adds support.
- No verification that Left/Right map to the correct physical direction — the direction-sign delta map is an unverified placeholder, same status as Aim's.
- No narrowing of angle bounds to the firmware's internal 45–135° obstacle-avoidance range.
- No new DOM/UI test harness or automated visual regression tooling.

## Further Notes

- **Open question (direction sign)**: Left→1°/Right→180° is an explicit, unverified placeholder pending hardware calibration and firmware support — flagged in code, same posture as Aim's own direction-sign constant.
- **Cross-plan dependency**: this plan's CSS class rename (`.qd005-section` → `.boxed-section`) touches a file the sibling `qd005-aim-controls` plan (mid-review as of this writing) also modifies. Implementer should check that plan's current state in `app/public/index.html` before editing, to avoid clobbering unreviewed work, and re-run that plan's own test/build checks if there's any overlap in the diff.
- **No firmware follow-up plan exists yet** — when firmware support for device `0x04` (or whatever code the firmware team eventually assigns) is added and the car reflashed, no app-side changes should be needed beyond removing the "placeholder" comment, since the wire format is already correct.
