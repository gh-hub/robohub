# Glossary: Distance Sensor Pan Control

## Protocol & Hardware

**Distance sensor servo** (also "distance-sensor pan servo" or "GPIO 25 servo")
- The servo mechanism (GPIO 25) that physically pans the QD001 base car's ultrasonic distance-sensor bracket left and right.
- Firmware variable name: `fixedServo` in the vendor `.ino` source.
- Angle range: 1–180° (integer values; firmware's internal obstacle-avoidance code happens to use 45–135°, but the full range is available).
- Firmware behavior (today): written directly (`fixedServo.write(angle)`, no `map()` transform) only by `model2_func()` (obstacle-avoidance sweep: 90°, then 45°/135° to sample left/right distance) and reset to 90° in `CMD_STANDBY` case.
- Currently unreachable from the app—no protocol device-code handler exists today.
- This plan's subject.

**Aim servo** (also "QD005 aim servo", for contrast)
- The servo mechanism (GPIO 26) that physically moves the QD005 water gun up and down.
- Device code: `0x02` in the binary command-frame protocol.
- Angle range: 1–180° (integer values).
- Firmware behavior: maps angle using `map(angle, 1, 180, 130, 70)`.
- Already app-reachable; renamed from "Pan" to "Aim" by the sibling plan (`qd005-aim-controls`).

**QD001 base car** (or "QD001 car" / "car platform")
- The ACEBOTT QD001 smart car platform.
- Includes onboard controls: Movement (motors), Lights, and Distance Sensor (GPIO 25 servo).
- Subject of this plan (distance-sensor control).

**QD005 attachment** (or "QD005 water-gun attachment")
- The complete water-gun attachment for the QD001 car: two devices (aim servo + shoot trigger) that are logically grouped as a single accessory.
- Subject of the sibling plan (`qd005-aim-controls`).
- Separate from the base-car hardware.

## Protocol & Commands

**Device code**
- A byte value in the binary command-frame protocol that specifies which device a command targets.
- Frame format: `0xFF 0x55 <len> <payload>` where the payload includes the device code at offset 7.
- Examples: `0x02` (aim servo), `0x03` (buzzer), `0x08` (shoot), `0x0C` (motor).

**Placeholder device code**
- A device code that is reserved in the protocol namespace but has no handler in the firmware's `runModule()` dispatch table yet.
- Example: `0x04` (distance sensor), defined in this plan but not handled by the firmware until future work adds support.
- Flagged with code comments to signal that firmware integration is still pending.

**Command dispatch** (or "runModule()")
- The firmware's main command-handling routine that reads the device code from an incoming frame and calls the appropriate handler (servo, buzzer, shoot, etc.).
- Currently handles: `0x02`, `0x03`, `0x05`, `0x08`, `0x0C`, `0x0D`, `0x1E`–`0x28`, `0x29`–`0x2B`.
- Does **not** handle device code `0x04` (distance sensor) today.

**tcp100** (or "TCP:100")
- Binary command-frame protocol session running on TCP port 100.
- Primary control channel for device commands (Aim servo, Shoot trigger, Movement, Lights, distance sensor, etc.).

## UI & App

**Distance sensor controls**
- The UI elements for controlling the distance-sensor servo horizontally: Left button, Right button, Speed selector, Angle readout.
- New in this plan; mirrors the existing Aim Up/Down control pattern.
- Contained within a new "Distance Sensor" section as of this plan.

**Distance Sensor section**
- New `<section>` wrapper introduced by this plan.
- Visually groups Distance Sensor controls together with a titled, bordered box (using the shared `.boxed-section` CSS class).
- Positioned after `#movement-controls`, before the QD005 Water Gun section.

**Movement controls**
- The car's main motor control UI: D-pad cross (forward/backward/left/right), discrete rotation buttons.
- Base-car hardware (part of QD001 platform).
- Visually separate from and distinct from QD005 attachment controls.

**Lights controls**
- The car's lighting control UI.
- Base-car hardware (part of QD001 platform).
- Visually separate from QD005 attachment controls.

**QD005 Water Gun section**
- New `<section>` wrapper (from the sibling plan `qd005-aim-controls`).
- Visually groups Aim Up/Down (renamed from "Pan") and Shoot controls together with a titled, bordered box (using the shared `.boxed-section` CSS class).
- Positioned after the Distance Sensor section, before `#log-panels`.

**Direction sign** (unverified for distance sensor)
- The convention for which angle direction represents "left" vs. "right": currently Left=toward 1°, Right=toward 180°.
- Flagged as unverified pending hardware calibration and real motion verification; easy to flip via single `DISTANCE_SENSOR_ANGLE_DELTA` constant change.
- Mirrors the Aim servo's own unverified direction-sign placeholder status.

**Boxed section** (or "boxed-section CSS class")
- Visual pattern for grouped, bordered UI sections with a titled heading.
- Defined via `<section class="boxed-section">` and corresponding CSS rules (border, padding, heading styling).
- Shared by both the "Distance Sensor" section (this plan) and the "QD005 Water Gun" section (sibling plan).
- Previously only `.qd005-section`, renamed to `.boxed-section` in this plan to reflect its use by multiple section types.

## Related Plans

**qd005-aim-controls** (sibling plan, in progress)
- Renames GPIO 26 servo from "Pan Left/Right" to "Aim Up/Down" across all app layers.
- Introduces the "QD005 Water Gun" boxed `<section>` UI grouping.
- Defines the `.qd005-section` CSS class (renamed to `.boxed-section` by this plan).
- Mid-review; implementer should check for conflicts if editing `app/public/index.html`.

**water-gun-fix-and-rotation** (prior plan, archived)
- Earlier plan (in `.gh-workflows/plans/done/`) that introduced the "Pan" naming (incorrectly assuming horizontal motion).
- Contains ADR-001.md documenting early servo protocol discovery.
- This plan (distance-servo-pan-control) does not reverse that plan's work—it addresses a separate, unrelated GPIO 25 servo.

## Firmware Context

**`fixedServo`** (vendor firmware variable)
- The firmware's internal variable name for GPIO 25, the distance-sensor bracket servo.
- Controlled internally by `model2_func()` (obstacle-avoidance) and `parseData()` (CMD_STANDBY reset).
- No command-dispatch case / device code in the firmware today.

**`model2_func()`** (vendor firmware function)
- Obstacle-avoidance logic: sweeps `fixedServo` to 90°, then 45° and 135°, sampling ultrasonic distance at each position.
- Runs autonomously when the car detects obstacles.
- Drives GPIO 25 without an app-issued protocol command.

**`runModule()`** (vendor firmware function)
- Command dispatch routine that reads device codes from incoming TCP frames and calls the appropriate handler.
- Does not have a handler for device code `0x04` (distance sensor) today.
- Future firmware work must add a `0x04` case to make this plan's app commands have physical effect.

**Flash backup**
- A binary image of the current ESP32 firmware, located at `backups/car-flash-backup-2026-08-20.bin`.
- Snapshot of the state before any potential future reflashing work (when firmware support for GPIO 25 is added).
