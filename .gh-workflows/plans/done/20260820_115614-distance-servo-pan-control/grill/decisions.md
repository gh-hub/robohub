# Decisions: Distance Sensor Pan Control

## Decision: Scope—app-side only, firmware deferred
Decided: This plan builds only the app-side plumbing (protocol constant, IPC channel, CarConnection method, renderer DOM wiring, UI markup/CSS) for a new Left/Right distance-sensor control. It does NOT modify the vendor `.ino` firmware source and does NOT reflash the physical ESP32. The firmware has no device-code handler for GPIO 25 today, so sending this new command will have no physical effect until a separate future effort adds firmware support and reflashes the car.

Why: Firmware editing + physical reflashing is a manual, out-of-band, hardware-risk step outside what this app-focused plan/repo can execute. The user explicitly chose to defer firmware work rather than bundle it in, keeping the scope tight and the risk contained to app-side code changes only. This unblocks the app infrastructure immediately while leaving the firmware integration as a clearly separated follow-up effort.

Alternatives rejected: Bundling firmware `.ino` edit + reflash instructions into this same plan (rejected—user chose app-only scope); deferring even the app-side code (rejected—user wants the infrastructure ready for firmware integration).

## Decision: Naming—"distance sensor"
Decided: All new identifiers use "distance sensor" (not "sensor pan" or "fixed servo"): `DEVICE_DISTANCE_SENSOR` (commandFrame.ts), `setDistanceSensorAngle()` (carConnection.ts, preload.ts CarApi, carIpcHandlers.ts CarConnectionLike), `handleSetDistanceSensorAngle()` (carIpcHandlers.ts), `CAR_SET_DISTANCE_SENSOR_ANGLE_CHANNEL = "car:set-distance-sensor-angle"` (ipcChannels.ts, preload.ts), `mapDistanceSensorControlUiState()` / `DistanceSensorControlUiState{leftDisabled,rightDisabled}` (connectionUiState.ts), renderer.ts: `renderDistanceSensor()`, `stepDistanceSensor()`, `handleDistanceSensorPointerDown/Release`, `stopActiveDistanceSensor`, `handleDistanceSensorSpeedChange`, `DISTANCE_SENSOR_REPEAT_INTERVAL_MS`, `DISTANCE_SENSOR_STEP_DEGREES`, `MIN_DISTANCE_SENSOR_ANGLE`/`MAX_DISTANCE_SENSOR_ANGLE`, `distanceSensorAngle`, `distanceSensorSpeed`, `distanceSensorHoldDirection`, `distanceSensorRepeatTimer`, `DISTANCE_SENSOR_ANGLE_DELTA`. HTML ids: `distance-sensor-left-button`, `distance-sensor-right-button`, `distance-sensor-speed-select`, `distance-sensor-angle-text`, wrapper `#distance-sensor-controls`.

Why: Names the control by what it points (the ultrasonic sensor), matching how GPIO 26 is named "aim" for what it does (aims the water gun), per the user's own phrasing. This is semantically clear and mirrors the established naming convention in the codebase.

Alternatives rejected: "sensor pan" (names the motion, not the sensor—user preferred the sensor-based name); "fixed servo" (uses the vendor's internal firmware variable name, not a user-facing descriptor).

## Decision: Device code placeholder—`0x04`
Decided: `DEVICE_DISTANCE_SENSOR = 0x04` in commandFrame.ts, with a code comment explicitly flagging it as an unverified placeholder with no firmware handler yet (mirroring the existing pattern for Aim's direction-sign placeholder), and a pointer back to this plan for when firmware support is added.

Why: `0x04` is confirmed unused in the current firmware's device-code dispatch table (used: 0x02, 0x03, 0x05, 0x08, 0x0C, 0x0D, 0x1E-0x2B). It reserves a slot in the protocol's namespace without colliding with any existing command, and the comment flags that firmware work must formally assign and handle this code before the app's commands have any physical effect.

Alternatives rejected: Using a higher-numbered placeholder (0x04 was the first available); deferring the device code assignment until firmware work (rejected—reserving it now prevents accidental reuse and makes the app-side code complete).

## Decision: Angle bounds—1–180, matching Aim
Decided: `MIN_DISTANCE_SENSOR_ANGLE = 1`, `MAX_DISTANCE_SENSOR_ANGLE = 180` — same bounds as the Aim servo, not narrowed to the 45–135 range the firmware's own obstacle-avoidance code happens to exercise.

Why: Keeps the two servo controls symmetric/consistent in validation code shape and UI; the narrower range is just what one autonomous mode happens to use, not a documented hardware limit. Users should be allowed the full mechanical range.

Alternatives rejected: 45–135 (narrower "safety margin" range)—rejected in favor of consistency with Aim and not imposing undocumented restrictions.

## Decision: Interaction—exact mirror of Aim
Decided: Hold-to-repeat at 400ms cadence (`DISTANCE_SENSOR_REPEAT_INTERVAL_MS = 400`), Fast/Slow speed dropdown with 10°/5° degree steps (`DISTANCE_SENSOR_STEP_DEGREES = {fast:10, slow:5}`), live angle readout text "Distance Sensor: {angle}°", resets to 90° on every connect/disconnect/error transition (same three reset points as `aimAngle`/`lightsOn`), direction-sign delta map flagged as unverified pending hardware calibration (mirroring `AIM_ANGLE_DELTA`'s pattern)—`DISTANCE_SENSOR_ANGLE_DELTA: Record<"left"|"right", 1|-1>`, exact sign TBD/flagged same as Aim's Up/Down was.

Why: User wants full behavioral consistency with the already-established Aim control pattern—same code shape, same UX conventions, minimal new interaction design. The familiar interaction pattern reduces user cognitive load and simplifies testing/maintenance.

Alternatives rejected: None proposed or considered—straightforward reuse of the proven Aim pattern.

## Decision: Button glyphs—◀ Left / ▶ Right
Decided: Use `&#9664;` / `&#9654;` — the same glyphs the pre-rename "Pan Left/Right" buttons used (now free since that control was renamed to Aim Up/Down with ▲/▼ glyphs in the sibling plan).

Why: Semantically correct for left/right motion, and reuses glyphs already established in this app's convention (D-pad's own left/right buttons use the same entities) rather than introducing new symbols. The glyphs are now available and appropriate for their original semantic purpose.

Alternatives rejected: New glyphs or text labels (would introduce inconsistency with D-pad convention); using up/down triangles (semantically wrong for horizontal motion).

## Decision: UI placement—new boxed section after Movement, before QD005
Decided: A new `<section>` titled "Distance Sensor", containing `#distance-sensor-controls` (the two buttons + speed select + angle text), positioned in `app/public/index.html` immediately after `#movement-controls` and before the QD005 Water Gun `<section>` (from the sibling plan).

Why: This servo is the QD001 base car's own hardware (steering/sensor bracket), not a QD005 attachment component. Grouping it with the base car's controls (Movement/Lights) rather than inside or after the QD005-specific section keeps the attachment-vs-base-car visual distinction the sibling plan is establishing. The logical flow is: base-car controls first (lights, movement, sensor pan), then attachment-specific controls (QD005 water gun), then monitoring (log panels).

Alternatives rejected: Placing it inside or after the QD005 section (would misleadingly imply this is QD005 hardware); appending at the very end of the page (breaks the base-car-controls-first visual grouping).

## Decision: CSS—generalize `.qd005-section` to `.boxed-section`
Decided: Rename the CSS class the sibling plan (`qd005-aim-controls`) defines for its bordered/heading box style, `.qd005-section` → `.boxed-section` (and its child selector `.qd005-section h2` → `.boxed-section h2`), in `app/public/index.html`'s `<style>` block and on the QD005 `<section>` element itself. Both the QD005 Water Gun section and this plan's new Distance Sensor section then use `class="boxed-section"`. This is a small, deliberate edit to a file the sibling plan also touches (that plan is mid-review, not yet merged).

Why: Two concrete sections now share an identical bordered/heading box visual pattern—a shared class name is the natural non-speculative abstraction (not a hypothetical future need), and `.qd005-section` is a misleading name once a non-QD005 section uses it too. Implementer should check for conflicts and re-run the sibling plan's tests if this file is touched.

Alternatives rejected: A new separate `.distance-sensor-section` class duplicating the same CSS rules (rejected—duplicated rules are harder to maintain and inconsistent); leaving the sibling plan's class name unchanged (rejected—becomes misleading once multiple sections use it).

## Decision: Testing—mirror Aim's existing coverage exactly
Decided: `connectionUiState.test.ts` gets a `mapDistanceSensorControlUiState` test suite mirroring `mapAimControlUiState`'s (same gating + bound-edge-case shape, `leftDisabled`/`rightDisabled` instead of `upDisabled`/`downDisabled`). `carIpcHandlers.test.ts` gets `handleSetDistanceSensorAngle` + `isValidDistanceSensorAngle`-equivalent validation tests mirroring the Aim angle tests (valid/invalid angle sets, error message format). `carConnection.test.ts` gets a `setDistanceSensorAngle()` frame-construction test mirroring `setAimAngle()`'s (asserts the exact command frame bytes: device `0x04`, action `CMD_RUN`). No new DOM/UI test harness—consistent with the codebase's existing testing posture for `renderer.ts`/`index.html` (verified only via `npm run build`/`npm run typecheck` + manual inspection).

Why: This repo has no DOM test harness at all (confirmed precedent from the Aim plan and prior water-gun plans); introducing one is out of scope and would break from established codebase-wide testing posture. Mirroring Aim's test structure ensures consistency and catches regressions in the same way Aim's own changes are validated.

Alternatives rejected: None—matches established codebase-wide testing posture.
