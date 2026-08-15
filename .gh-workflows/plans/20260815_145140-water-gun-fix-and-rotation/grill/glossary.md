# Glossary: water-gun-fix-and-rotation

- **Pan** — Horizontal left/right sweep of the single controllable servo (GPIO 26 / device `0x02`), which this plan establishes is physically mounted on the ultrasonic distance sensor bracket on this build, not the gun barrel. See also **TURN_SERVO_PIN**.

- **Discrete rotate** — A click-triggered, fixed-duration rotate-then-stop action (90°/180°), as opposed to the existing "continuous rotate" (hold-to-spin, release-to-stop) D-pad buttons. Implemented via timed pulse: send the rotate command, wait a fixed duration, then send Stop.

- **TURN_SERVO_PIN / FIXED_SERVO_PIN** — Firmware-level GPIO pin names from the stock ACEBOTT QD005 `.ino` sketches (GPIO 26 and GPIO 25 respectively). Only `TURN_SERVO_PIN` (26) is reachable from the app's wire protocol via device code `0x02`; `FIXED_SERVO_PIN` (25) is firmware-internal only (used by the obstacle-avoidance sweep, never exposed to the wire protocol).

- **QA052 shield** — The expansion board that bridges the ACEBOTT QD005 car's ESP32 to the JST connectors and GPIO headers. Includes the `U4` driver chip (unidentified, near the Shoot JST connector), whose malfunction is suspected in the non-firing Shoot issue. See `docs/qd001-hardware-access/pin-mapping.md`.
