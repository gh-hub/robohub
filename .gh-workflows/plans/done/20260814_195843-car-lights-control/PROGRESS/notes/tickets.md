# Session end-state: tickets phase

## What happened

Tickets phase: read the "Draft ticket breakdown" from `PROGRESS/notes/spec.md`, presented it to the user for approval in a live checkpoint. User approved the breakdown as-is with no changes. Delegated file write-up to `.gh-workflows/plans/20260814_195843-car-lights-control/tickets/01-command-frame-protocol-layer.md` and `02-light-toggle-ui-ipc.md`.

## Ticket summary

**Ticket 01: Command-frame protocol layer on CarConnection**
- Blocked by: none
- Delivers: Pure-function frame builder per ADR-001 format + frame-sending capability on main-process CarConnection layer, writing to TCP socket only when connected on tcp100, rejecting without write when disconnected or on http80
- Testing: Pure-function unit tests for frame builder, mock-TCP-server tests for exact byte sequences
- Live-hardware confirmation: manually verifiable via devtools-console call against real car

**Ticket 02: Left/Right Light toggle buttons, IPC, and mirrored renderer state**
- Blocked by: Ticket 01
- Delivers: Complete user-facing feature with two toggle buttons in index.html, optimistic state tracking, tcp100-only gating, state reset on every connect/disconnect
- Testing: FakeCarConnection-based IPC handler tests, pure-function UI-state-mapping tests

## What's next

Implement ticket 01: begin with frame builder pure function and its unit tests, then add frame-sending capability to CarConnection with mock-TCP-server tests.
