# Grill Phase End-State: water-gun-fix-and-rotation

## Session Summary

Live grill interview with the user on 2026-08-15, conducted with full codebase verification. All findings confirmed directly by the user, including an explicit final "yes, proceed" confirmation. Output files written and placed in `grill/` directory.

## Decisions Confirmed (D1–D4)

**D1 — Firmware/pin match:** User confirmed physical car runs stock ACEBOTT QD005 firmware. GPIO 26 (`TURN_SERVO_PIN`) is the target of app's `DEVICE_SERVO = 0x02`. Verified against actual `.ino` sketches (Car A and Car B variants). No firmware changes needed.

**D2 — Pan/Aim repurposing:** The single controllable servo (GPIO 26 / device `0x02`) is physically mounted on the ultrasonic distance sensor bracket, not the gun barrel. Decision: rename all Aim Up/Down identifiers/labels/types to Pan Left/Right, keeping mechanics unchanged. All concrete scope items (type renames, function renames, HTML id renames, label text) detailed in ADR-001.md. User confirmed this is correct.

**D3 — Shoot diagnosis:** App's `DEVICE_SHOOT = 0x08` command already matches firmware pulse byte-for-byte. UI gating logic verified correct. Shoot non-function diagnosed as hardware issue (wiring, motor/pump, or `U4` driver chip on QA052 shield). No code fix. User acknowledged this is a physical repair task outside scope.

**D4 — Discrete rotate buttons:** Add 4 new one-click buttons (90°/180° left/right) via timed pulse (400ms/800ms). Interrupt any active D-pad hold, send rotate command, wait, send Stop, disable all movement/rotation buttons during window. Durations flagged as unverified placeholders pending hardware calibration (following precedent of `AIM_ANGLE_DELTA` comment in prior plan). User confirmed this meets their needs.

## Investigation Findings (Verified Against Hardware)

All facts in requirements.md "Environment Notes" section were gathered during interview and independently verified against actual firmware source files and codebase:
- Device codes and protocol values from `app/src/commandFrame.ts`
- GPIO pin mapping from QD005 firmware `.ino` sketches (Car A and Car B)
- Existing Aim control structure in `app/src/renderer.ts`
- Movement/D-pad structure in `app/src/renderer.ts`
- HTML structure in `app/public/index.html`
- Protocol reference from `docs/qd001-hardware-access/protocol-reference.md`
- Hardware pin mapping from `docs/qd001-hardware-access/pin-mapping.md`

## Grill Output Files

Written to `.gh-workflows/plans/20260815_145140-water-gun-fix-and-rotation/grill/`:
- `requirements.md` — Problem statement, solution, done criteria, out of scope, environment notes
- `decisions.md` — D1–D4 in standard format (Decided/Why/Alternatives Rejected)
- `glossary.md` — Term definitions (Pan, Discrete rotate, TURN_SERVO_PIN/FIXED_SERVO_PIN, QA052 shield)
- `ADR-001.md` — Detailed ADR for Pan repurposing (scope, unchanged mechanics, why, alternatives)
- `ADR-002.md` — Detailed ADR for Discrete rotate (implementation details, constants, handlers, why, alternatives)

## Next Phase: Spec

The spec phase will generate implementation tickets from these decisions. Key items to spec:
1. Pan control renaming across `app/src/renderer.ts`, `app/src/connectionUiState.ts`, and `app/public/index.html`
2. Discrete rotate button implementation: handlers, HTML elements, disable/enable gating
3. Documentation of the Shoot hardware issue (diagnosis, QA052 shield `U4` chip note, troubleshooting guide for user)

No code changes have been made yet. The codebase is clean and ready for the spec phase to generate tickets.

## Session End Time

Grill phase completed: 2026-08-15 14:58:00
