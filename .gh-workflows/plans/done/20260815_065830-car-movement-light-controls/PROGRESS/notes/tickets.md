# Tickets Phase: Session End-State

## Ticket breakdown

Three tickets approved and transcribed:

1. **01 — Lights: consolidate to a single button** (no dependencies)
   - UI-only change: replace two light buttons with one
   - No protocol/IPC/backend changes needed
   
2. **02 — Movement command-frame protocol layer on CarConnection** (no dependencies, can run in parallel with ticket 01)
   - Add `DEVICE_MOTOR` constant and direction-to-value mapping
   - Add `setMovement(direction)` method with same gating/rejection as `setLedState()`
   - Unit tests only, no UI changes
   
3. **03 — Movement D-pad UI, IPC, and press-and-hold interaction** (blocked by ticket 02)
   - Complete user-facing movement feature
   - IPC channel, handler, preload exposure
   - Six D-pad buttons with pointer event wiring and interrupt semantics
   - Requires manual hardware verification

## What's next

Start implementing ticket 01 — Lights: consolidate to a single button. This is an isolated UI simplification with no protocol/IPC changes, making it a safe starting point. Ticket 02 can begin in parallel, but per gh-dev-workflow session discipline, implement one at a time.
