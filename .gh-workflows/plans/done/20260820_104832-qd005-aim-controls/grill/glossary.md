# Glossary: QD005 Aim Controls

## Protocol & Hardware

**Aim servo** (also "QD005 aim servo")
- The servo mechanism (GPIO 26) that physically moves the QD005 water gun up and down.
- Device code: `0x02` in the binary command-frame protocol.
- Angle range: 1–180° (integer values).
- Firmware behavior: maps angle using `map(angle, 1, 180, 130, 70)` over ~300-400ms travel time.
- Previously mislabeled as "Pan" in the codebase.

**Shoot** / **Blaster trigger**
- The solenoid/trigger mechanism (GPIO 32) that fires the water gun.
- Device code: `0x08` in the binary command-frame protocol.
- Pulse width: fixed 200ms per trigger.
- Unchanged by this plan (logic/handlers untouched; only UI container regrouped).

**QD005** (also "QD005 attachment" / "QD005 water-gun attachment")
- The complete water-gun attachment for the ACEBOTT QD001 car: two devices (aim servo + shoot trigger) that are logically grouped as a single accessory.
- Subject of this rename/grouping plan.

**ACEBOTT QD001** (or "QD001 car")
- The car platform on which the QD005 attachment is mounted.
- Main vehicle control (Movement, Lights) is separate from QD005-specific controls.

## Protocol Sessions

**tcp100** (or "TCP:100")
- Binary command-frame protocol session running on TCP port 100.
- Frame format: `0xFF 0x55 <len> <payload>`.
- Primary control channel for device commands (Aim servo, Shoot trigger, Movement, Lights, etc.).

**http80** / **http81** (or "HTTP:80" / "HTTP:81")
- HTTP fallback protocol sessions running on ports 80 and 81.
- Used when TCP:100 is unavailable; semantically equivalent to tcp100.

## UI & App

**Aim controls**
- The UI elements for controlling the aim servo vertically: Up button, Down button, Speed selector, Angle readout.
- Previously called "Pan controls" in the codebase.
- Contained within the new "QD005 Water Gun" section as of this plan.

**Shoot controls**
- The UI elements for triggering the water gun: Shoot button, cooldown toggle.
- Previously in a separate `#shoot-controls` div; now grouped in the new "QD005 Water Gun" section.

**QD005 Water Gun section**
- New `<section>` wrapper introduced by this plan.
- Visually groups Aim + Shoot controls together with a titled, bordered box (similar to `.log-panel-container` pattern).
- Positioned after `#movement-controls`, before `#log-panels`.

**Movement controls**
- The car's main motor control UI: D-pad cross (forward/backward/left/right), discrete rotation buttons.
- Separate from and visually distinct from QD005 controls.

**Lights controls**
- The car's lighting control UI.
- Separate from QD005 controls.

**Direction sign** (unverified)
- The convention for which angle direction represents "up" vs. "down": currently Up=toward 180°, Down=toward 1°.
- Flagged as unverified pending hardware calibration; easy to flip via single constant change.

## Related History

**Prior plan: water-gun-fix-and-rotation**
- An earlier plan (located in `.gh-workflows/plans/done/`) that incorrectly renamed the original "Aim Up/Down" design to "Pan Left/Right" based on a mistaken assumption about servo motion.
- **ADR-001.md** (in that prior plan) documents the servo protocol discovery and originally used the correct name "Aim Up/Down"; it remains accurate and its protocol facts do not become false with this rename.
- The current plan (qd005-aim-controls) reverses that incorrect rename back to the original, correct naming.
