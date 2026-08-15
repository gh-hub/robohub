# 03 — Movement D-pad UI, IPC, and press-and-hold interaction

**What to build:** The complete user-facing movement feature. New `car:set-movement` IPC channel; `handleSetMovement` IPC handler (extending the `CarConnectionLike` pattern used for lights); `preload.ts` exposure of `setMovement` on `window.carAPI`; a pure `mapMovementControlUiState` gating function (same pattern as `mapLightControlUiState`); six D-pad buttons in the UI (cross layout for Forward/Backward/Left/Right, plus a rotate row below for Rotate Left/Rotate Right); pointer-event wiring in the renderer (`pointerdown`/`pointerup`/`pointerleave`/`pointercancel`), `window.blur` handling, and `activeDirection` interrupt/matching state so that pressing a new direction while one is held correctly interrupts the previous one and releasing/losing focus sends Stop.

**Blocked by:** 02 — Movement command-frame protocol layer on CarConnection

**Status:** ready

- [x] IPC channel, handler, and preload exposure implemented and tested via FakeCarConnection-based tests
- [x] `mapMovementControlUiState` pure function implemented and unit tested
- [x] Six D-pad buttons present in the UI in the cross+rotate-row layout
- [x] Pointer event wiring implemented for press-and-hold with correct interrupt semantics (new direction press while held interrupts the prior direction) and Stop-on-release/blur/pointer-leave/pointer-cancel
- [ ] **OUTSTANDING — requires the user:** Interrupt semantics and full D-pad behavior manually verified against real hardware (flag this as required manual verification, not unit-testable, per existing project convention)
- [ ] **OUTSTANDING — requires the user:** Demoable — press-and-hold each direction button on real hardware, confirm motion starts/stops correctly including interrupt behavior

Note: the two unchecked items above both require physical ACEBOTT QD001 hardware and a human at the controls — they cannot be completed by an agent. Everything else (IPC, pure gating logic, D-pad markup, pointer-event wiring, typecheck, full test suite, build) is done and verified. See `PROGRESS/notes/implement-03-movement-dpad-ui.md` for the manual test checklist to run before merging.
