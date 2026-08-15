# Requirements: water-gun-fix-and-rotation

## Problem Statement

After wiring up the QD005 water-gun attachment to the ACEBOTT QD001 car and implementing basic shoot + aim controls via the Electron app (`app/src/`), hardware testing revealed two behavioral issues and one missing feature:

1. **Aim buttons mislabeled**: The app's "Aim Up/Down" buttons do not control the gun barrel. Instead, they move the ultrasonic distance sensor's pan bracket left and right. The servo control is wired to the wrong physical component.
2. **Shoot button non-functional**: Clicking the Shoot button in the app produces zero physical effect — no motion, sound, or any response from the blaster mechanism.
3. **Missing discrete rotation**: Users need quick one-click rotation buttons (90°/180°, left/right) rather than only the existing hold-to-rotate D-pad buttons.

## Solution

**For Issue #1 (Aim/Pan mislabeling):** Repurpose the existing Aim Up/Down control end-to-end as Pan Left/Right. Rename all UI labels, identifiers, and type names from directional up/down semantics to left/right semantics (e.g., `AimDirection` → `PanDirection`, `aim-up-button` → `pan-left-button`, "Aim: 90°" → "Pan: 90°"), while keeping the underlying mechanics completely unchanged. The single controllable servo (GPIO 26 / device code `0x02`) will continue to use the same step-based protocol command, bounds (1–180°), speed options (Fast 10°/Slow 5° step), and press-and-hold repeat logic (400ms interval).

**For Issue #2 (Shoot non-functional):** Diagnosis only — no code fix. The app's `DEVICE_SHOOT = 0x08` command already matches the stock ACEBOTT QD005 firmware's expected pulse byte-for-byte, and the UI enable/disable gating logic has been independently verified as correct. This is a hardware-layer problem (wiring, the blaster motor/pump, or the driver chip near the Shoot JST connector on the QA052 shield). Document the diagnosis and provide the user with troubleshooting guidance; the actual repair is a physical task outside the scope of this code plan.

**For Issue #3 (Discrete rotation):** Add four new one-click buttons (distinct from the existing continuous hold-to-rotate D-pad): "Rotate 90° Left", "Rotate 90° Right", "Rotate 180° Left", "Rotate 180° Right". Each button reuses the existing `rotate-left`/`rotate-right` movement commands (protocol values already defined: `0x09`/`0x0a`), sends the command, waits a fixed duration (400ms for 90°, 800ms for 180°), then sends Stop. During the timed window, all movement and rotation buttons (both discrete and continuous) are disabled, following the same interrupt + cooldown pattern as the existing Shoot action. Default durations are placeholders pending hardware calibration.

## Done Criteria

- ✓ All Aim Up/Down labels, identifiers, and type names renamed to Pan Left/Right throughout `app/src/` and `app/public/index.html`.
- ✓ Aim control semantics (step direction sign, bounds, speeds, repeat logic, connection gating) remain unchanged and verified functionally equivalent.
- ✓ Shoot issue is documented and diagnosed; user has guidance for physical troubleshooting.
- ✓ Four new discrete rotate buttons appear in the UI (separate row or section, distinct HTML ids).
- ✓ Discrete rotate buttons interrupt any active continuous D-pad movement and enforce disable-during-action for all rotation controls.
- ✓ Rotation duration constants are clearly commented as placeholders requiring hardware calibration.
- ✓ All changes verified against the actual QD005 firmware source (not guessed from docs).

## Out of Scope

- No firmware/ESP32 sketch changes — `.ino` sources in `docs/` are reference-only.
- No hardware repairs for the Shoot mechanism — diagnosis and documentation only.
- No new second servo channel for a "true" gun-aim axis — the protocol supports only one reachable servo (GPIO 26).
- Discrete rotation is approximate (timed-pulse based) and will require real hardware calibration post-ship.

## Environment Notes

### Codebase Facts (Verified Against Hardware)

- **Device codes (from `app/src/commandFrame.ts`):** `DEVICE_SERVO = 0x02` (pan servo), `DEVICE_SHOOT = 0x08` (blaster trigger), `DEVICE_MOTOR = 0x0c` (movement). `MOVEMENT_VALUES` already defines `"rotate-left": 0x09` and `"rotate-right": 0x0a`.
- **Firmware pin mapping (from stock QD005 `.ino` sketches, Car A and Car B variants):**
  - `Shoot_PIN = 32`: Driven by `case 0x08: digitalWrite(Shoot_PIN, HIGH); delay(200); digitalWrite(Shoot_PIN, LOW);` inside `runModule()`.
  - `TURN_SERVO_PIN = 26`: Driven by `Servo_Move(val)` under `case 0x02:` in `runModule()`. This is the single reachable servo.
  - `FIXED_SERVO_PIN = 25`: Firmware-internal only (obstacle-avoidance sweep); no device code maps to it.
- **UI state / Shoot gating (from `app/src/connectionUiState.ts`, `mapShootControlUiState()`):** Gating logic is correct (`disabled: connection.status !== "connected" || connection.protocol !== "tcp100"`).
- **Existing Aim control (from `app/src/renderer.ts`):** Implements `AimDirection` type, `AIM_ANGLE_DELTA`, `AIM_BUTTON_IDS`, `handleAimPointerDown`/`handleAimRelease`, `stepAim()`, angle/speed/hold state vars, repeat timer (400ms), and bounds (1–180°). All mechanics are stable and verified.
- **Existing Movement/D-pad (from `app/src/renderer.ts`):** Implements `MovementDirection` type, `MOVEMENT_BUTTON_IDS` (already includes `rotate-left`/`rotate-right` for continuous D-pad buttons), `activeDirection`, hold/release handlers, and `stopActiveMovement()`.
- **HTML structure (from `app/public/index.html`):** `#aim-controls` div contains aim buttons and speed select. `#movement-controls` div has D-pad cross and `.dpad-rotate-row` with existing `#rotate-left`/`#rotate-right`. New discrete rotate buttons need new HTML ids and a placement (likely a new row below `.dpad-rotate-row`).
- **Protocol reference (from `docs/qd001-hardware-access/protocol-reference.md`):** Full device/action-code table confirms only `0x02` is a servo channel; no angle-based rotation primitive exists (only continuous spin-until-stop).
- **Project precedent for unverified assumptions:** `AIM_ANGLE_DELTA` in the prior plan is commented "direction sign is a starting assumption... unverified against physical hardware... if backwards, this is the one line to flip." New rotate-duration constants follow this same pattern.
