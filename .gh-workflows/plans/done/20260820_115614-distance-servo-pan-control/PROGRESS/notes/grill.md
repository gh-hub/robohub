# Session: Grill Phase — Distance Sensor Pan Control

**Date:** 2026-08-20  
**Phase:** grill (complete)

## What was gathered

Grill phase outputs written to `grill/`:
- **[requirements.md](../../grill/requirements.md)** — Problem/Solution/Done criteria/Out of scope + Environment notes covering pin mapping, firmware device-code dispatch table, vendor `.ino` behavior, flash pipeline context, current HTML structure, Aim pattern reference.
- **[decisions.md](../../grill/decisions.md)** — 9 confirmed decisions (app-scope only, naming, device-code placeholder 0x04, angle bounds, interaction pattern, button glyphs, UI placement, CSS generalization, test coverage).
- **[glossary.md](../../grill/glossary.md)** — Definitions of distance sensor servo, aim servo (for contrast), QD001 base car, QD005 attachment, device codes, placeholder device codes, command dispatch, UI sections, direction sign, boxed section CSS pattern, firmware variables/functions.

No ADR file written. The "app-side only, firmware deferred" decision and placeholder device-code decision, while significant for future firmware work, do not rise to the "lasting architectural consequence / API-contract weight" of prior ADR decisions in this repo. The scope decision is captured clearly in Decision 1 of decisions.md, with pointers to when firmware support is added. Mirrors the sibling plan's (qd005-aim-controls) decision not to write an ADR despite touching protocol/UI decisions.

## What's next

**Phase: spec+tickets**
- Write spec.md: detailed step-by-step implementation guide (file-by-file edits, with code snippets for the key new functions/constants).
- Write tickets/ with implementation tickets (likely: one ticket per layer—protocol/frame, IPC, main-process handlers, preload bridge, renderer, HTML/CSS, tests).
- Potentially coordinate with sibling plan (qd005-aim-controls) review status before implementing index.html edits (CSS class rename `.qd005-section`→`.boxed-section`).

## Key uncertainties resolved

- **Pin mapping confirmed:** GPIO 25 = QD001's distance-sensor servo; GPIO 26 = QD005 aim servo (already reachable).
- **Firmware ground truth confirmed:** device codes 0x02, 0x03, 0x05, 0x08, 0x0C, 0x0D, 0x1E-0x28, 0x29-0x2B are handled; 0x04 is free and will be the placeholder for distance sensor.
- **Vendor `.ino` behavior confirmed:** GPIO 25 / `fixedServo` is driven only by `model2_func()` (obstacle-avoidance) and `CMD_STANDBY` reset, with no app-reachable device code today.
- **Flash pipeline confirmed:** no build/flash in this repo; vendor `.ino` is read-only reference; reflashing is manual, out-of-band.
- **UI structure confirmed:** placement is after `#movement-controls`, before QD005 section (from sibling plan).
- **Naming confirmed:** "distance sensor" as the user-facing term, mirroring Aim's semantic naming.
