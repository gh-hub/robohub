# 02 — Aim control end-to-end

**What to build:** a press-and-hold Up/Down button pair in the UI that walks the servo to angles 1–180°, with a Fast/Slow dropdown to control step size (10° or 5°). Angle is tracked and clamped. Buttons disable at servo bounds (1° and 180°). Button disabled when not connected or when TCP100 handshake hasn't completed.

**Blocked by:** None — can start immediately

**Status:** ready

- [x] `DEVICE_SERVO` constant defined in `commandFrame.ts`
- [x] `CarConnection.setAimAngle(angle)` method implemented
- [x] `CarConnection.setAimAngle()` passes byte-exact mock-TCP-server tests across representative angles
- [x] `CarConnection.setAimAngle()` rejects when not connected
- [x] `CarConnection.setAimAngle()` rejects when TCP100 handshake not complete
- [x] `car:set-aim-angle` IPC channel implemented with main-process handler
- [x] `car:set-aim-angle` handler validates angle range 1–180 at trust boundary
- [x] `car:set-aim-angle` handler is backed by `FakeCarConnection` and tested (including validation boundary)
- [x] Preload exposes `setAimAngle` IPC call to renderer
- [x] Up/Down buttons added to control panel
- [x] Fast/Slow speed dropdown added with 10° and 5° options
- [x] Press-and-hold event handlers wired (pointerdown, pointerup, pointerleave, pointercancel)
- [x] Window-blur safety net prevents repeat after window loses focus
- [x] Throttled fixed-cadence repeat implemented (400ms matching firmware blocking time)
- [x] Renderer-side `aimAngle` state variable created with default 90°
- [x] `aimAngle` clamped to 1–180° range
- [x] `aimAngle` reset to 90° on connect/disconnect/error (per existing `lightsOn` precedent)
- [x] `mapAimControlUiState()` pure function created for connection-state gating
- [x] `mapAimControlUiState()` covers both angle-bound edge cases (1° and 180°)
- [x] `mapAimControlUiState()` unit tested
- [ ] Manual test: holding Up/Down in running app walks the real servo — NOT DONE: no physical car/hardware access in this sandboxed coding-agent environment. Requires a human with the real QD005 unit; see PROGRESS/notes/implement-02-aim-control.md.
- [ ] Manual test: servo direction verified live and flipped if backwards (ADR-001 open question) — NOT DONE, same reason. `AIM_ANGLE_DELTA` in `app/src/renderer.ts` is the one place to flip if backwards (documented inline).
- [ ] Manual test: button disabling at 1° and 180° bounds is verified — the underlying logic (`mapAimControlUiState`) is unit-tested for both bounds, but visual/live verification in the running app against the real car was NOT DONE, same reason.
