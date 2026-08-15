# water-gun-fix-and-rotation

## What we're building
Fix the QD005 water-gun aim control (mislabeled as up/down when it actually pans the ultrasonic distance sensor left/right) and diagnose the non-firing shoot button, plus add discrete 90°/180° left/right rotation buttons to the movement controls.

## Status
Workflow: full
Current phase: fixing (review round-1)

## Links
- [PROGRESS/](PROGRESS/INDEX.md)
- [CONTEXT.md](CONTEXT.md)
- [Grill output](grill/)
- [Spec](spec.md)
- [Tickets](tickets/):
  - [01 — Pan rename (Aim → Pan)](tickets/01-pan-rename.md)
  - [02 — Discrete rotate buttons (90°/180° Left/Right)](tickets/02-discrete-rotate-buttons.md)
- [Review](review/):
  - [Round 1 findings](review/round-1/findings.md) — FAIL (spec-match/security clean; test gate failed on a pre-existing, unrelated usbStatus.test.ts gap)
