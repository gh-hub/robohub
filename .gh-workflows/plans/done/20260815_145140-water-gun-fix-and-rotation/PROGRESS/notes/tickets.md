# Tickets Phase End-State: water-gun-fix-and-rotation

## Breakdown Summary

Two tickets were written and approved by the user at the live checkpoint:

1. **01 — Pan rename (Aim → Pan)**: Repurpose the existing Aim Up/Down servo control end-to-end into Pan Left/Right, so the UI matches what the hardware actually does (panning the ultrasonic distance sensor bracket left/right). No behavior change — same servo protocol command, bounds, speeds, repeat interval, connection gating, reset behavior. The user also approved expanding this ticket's scope to include renaming the `setAimAngle` IPC method to `setPanAngle` throughout (`preload.ts`, `main.ts`, `ipcChannels.ts`, `carIpcHandlers.ts`, and tests) for full naming consistency end-to-end.

2. **02 — Discrete rotate buttons (90°/180° Left/Right)**: Add four new one-click buttons — Rotate 90° Left, Rotate 90° Right, Rotate 180° Left, Rotate 180° Right — distinct from the existing continuous hold-to-rotate D-pad buttons. Each click interrupts any currently-active D-pad movement, sends the car spinning via the existing `rotate-left`/`rotate-right` movement command with a fixed placeholder duration (400ms for 90°, 800ms for 180°, pending hardware calibration), then sends Stop. No new protocol/device/IPC code — reuses the already-defined `MOVEMENT_VALUES` and existing `setMovement`/`sendMovement` IPC path. Includes interrupt/disable-during-action semantics and safety-net cleanup on connection drop / alt-tab blur.

No blocking edges between tickets — both can start immediately. Ticket 02 is noted as coordinating with ticket 01 since they both touch `app/src/renderer.ts` in disjoint regions (Pan renames state/functions, ticket 02 adds rotateCooldownActive and handleDiscreteRotate) and should rebase cleanly if in flight concurrently.

## Approvals

The user explicitly approved this exact ticket breakdown at the live checkpoint (2026-08-15 ~15:05) with no changes to granularity, scope, or blocking edges. The IPC method naming decision (setAimAngle → setPanAngle) was originally left as an open question in spec.md but was resolved at the tickets checkpoint — the user approved folding it into ticket 01.

## Next Phase

Implement ticket 01 (Pan rename). Load the ticket file and the spec for technical detail.
