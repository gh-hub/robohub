# 01 — Shoot control end-to-end

**What to build:** a single-click Shoot button in the UI that fires one 200ms pulse to the car's water pump motor when clicked. The user can toggle a cooldown control on/off. Button is disabled when not connected or when TCP100 handshake hasn't completed.

**Blocked by:** None — can start immediately

**Status:** ready

- [x] `DEVICE_SHOOT` constant defined in `commandFrame.ts`
- [x] `CarConnection.shoot()` method implemented
- [x] `CarConnection.shoot()` passes byte-exact mock-TCP-server test
- [x] `CarConnection.shoot()` rejects when not connected
- [x] `CarConnection.shoot()` rejects when TCP100 handshake not complete
- [x] `car:shoot` IPC channel implemented with main-process handler
- [x] `car:shoot` handler is backed by `FakeCarConnection` and unit tested
- [x] Preload exposes `shoot` IPC call to renderer
- [x] Shoot button UI element added to control panel
- [x] Shoot button click handler fires the IPC call
- [x] Shoot button disabled when `connected && tcp100` is false
- [x] Cooldown toggle UI control added
- [x] `mapShootControlUiState()` pure function created for connection-state gating
- [x] `mapShootControlUiState()` unit tested across full connection-state matrix
- [ ] Manual test: clicking Shoot in running app fires one 200ms pulse on real car — **NOT DONE**: this coding-agent environment has no physical access to the car/QD005 hardware. All static analysis, byte-exact wire tests (mock TCP server), and typecheck/build/full-suite pass, but the actual firmware response to device 0x08 has never been exercised. Per ADR-001 this is a hard completion gate — a human with the physical car must click Shoot in the running app (`npm start`) and confirm one 200ms pulse fires before this plan can be considered done.
- [ ] Manual test: toggling cooldown on/off is visually verified — **NOT DONE**: same hardware/environment limitation as above. Toggle wiring (`shoot-cooldown-toggle` checkbox, `handleShootCooldownToggleChange`) is implemented per spec but not visually verified in a running Electron window in this environment.
