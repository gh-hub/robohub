# 02 — Movement command-frame protocol layer on CarConnection

**What to build:** Add `DEVICE_MOTOR` constant and a direction-to-value mapping (Stop/Forward/Backward/Left/Right/Rotate Left/Rotate Right) to the command-frame protocol layer, per ADR-001's device/value table. Add `setMovement(direction)` to `CarConnection`, mirroring `setLedState()`'s gating and rejection contract exactly (rejects when disconnected or on http80 port, same as lights). Extend the existing pure-function tests to cover every direction's exact byte sequence. Extend the existing mock-TCP-server tests to cover `setMovement()` for every direction plus rejection when disconnected/http80.

**Blocked by:** None — can start immediately

**Status:** done

- [x] `DEVICE_MOTOR` and direction-to-value mapping added matching ADR-001
- [x] `setMovement(direction)` implemented on `CarConnection` with same gating/rejection contract as `setLedState()`
- [x] Unit tests cover wire-byte correctness for all 7 direction values
- [x] Unit tests cover rejection behavior when disconnected and when on http80
- [x] No UI changes in this ticket — verified via passing unit tests only
