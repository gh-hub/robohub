# Implement notes: 01-shoot-control

## What was built

End-to-end Shoot control, following the exact seam pattern established by the lights/movement plans:

- `app/src/commandFrame.ts`: `DEVICE_SHOOT = 0x08` and `SHOOT_VALUE = 0x00` constants, per ADR-001.
- `app/src/commandFrame.test.ts`: byte-exact frame test for the shoot device code.
- `app/src/carConnection.ts`: `CarConnection.shoot()` — thin wrapper over `sendCommandFrame()`, same gating/rejection contract as `setLedState()`/`setMovement()` (inherited, not duplicated).
- `app/src/carConnection.test.ts`: byte-exact mock-TCP-server test for `shoot()`, plus "rejects when disconnected" and "rejects on http80" cases.
- `app/src/ipcChannels.ts`: `CAR_SHOOT_CHANNEL = "car:shoot"`.
- `app/src/carIpcHandlers.ts`: `shoot()` added to `CarConnectionLike`; `handleShoot` added to `CarIpcHandlers` and `createCarIpcHandlers()`.
- `app/src/carIpcHandlers.test.ts`: `FakeCarConnection` extended with `shoot()`/`shootCallCount`/`onShoot`; tests for `handleShoot` call-through and rejection propagation.
- `app/src/connectionUiState.ts`: `mapShootControlUiState()` — pure function, identical gating shape to `mapMovementControlUiState` (`connected && tcp100`). Cooldown is deliberately NOT part of this pure function (see below).
- `app/src/connectionUiState.test.ts`: table-driven tests across the full connection-state matrix (disconnected, connecting, connected+tcp100, connected+http80, error).
- `app/src/preload.ts`: `shoot: () => Promise<void>` added to `CarApi` and wired to `ipcRenderer.invoke(CAR_SHOOT_CHANNEL)`. Inlined channel constant, matching this file's existing no-local-imports convention.
- `app/src/renderer.ts`: `shoot-button` click handler (`handleShootClick`) fires `window.carAPI.shoot()`; cooldown toggle (`shoot-cooldown-toggle` checkbox) wired via `handleShootCooldownToggleChange`; `shootCooldownActive` module-level flag set/cleared via `setTimeout(SHOOT_COOLDOWN_MS = 300)`; `renderShoot()` combines `mapShootControlUiState(state).disabled || shootCooldownActive` — connection gating and the cooldown timer are independent concerns, combined only at this DOM layer, not folded into the pure mapper.
- `app/src/main.ts`: `ipcMain.handle(CAR_SHOOT_CHANNEL, ...)` wired to `carIpcHandlers.handleShoot()`.
- `app/public/index.html`: `#shoot-controls` div with `#shoot-button` (disabled by default, matching the existing convention) and `#shoot-cooldown-toggle` checkbox (checked by default, per ADR-001's "cooldown on by default").

## Test results

- `npm test` (full suite): 97/97 passing (was 68 before this ticket; +29 new tests across commandFrame/carConnection/carIpcHandlers/connectionUiState).
- `npx tsc --noEmit` and `npx tsc --project tsconfig.renderer.json --noEmit`: both clean.
- `npm run build`: succeeds.

## Ambiguities resolved by inference (not blocking)

- ADR-001 mentions adding a "value constant for shoot" without naming it; named it `SHOOT_VALUE` to mirror the existing `MOVEMENT_VALUES` naming convention.
- The cooldown-toggle DOM id (`shoot-cooldown-toggle`) and label wrapper id (`shoot-cooldown-toggle-label`) are new implementation-detail names, not specified anywhere — chosen to match the existing `light-button`/`toggle-button` naming style.

## Blocker: manual hardware verification not performed

Two acceptance criteria are unchecked in `tickets/01-shoot-control.md`:

- Manual test: clicking Shoot in the running app fires one 200ms pulse on the real car.
- Manual test: toggling cooldown on/off is visually verified.

Per ADR-001 and spec.md, these are explicit, non-optional completion gates — device 0x08 has never been live-tested against the physical QD005 unit before this plan. This coding-agent environment has no physical access to the car or its Wi-Fi network, so these two criteria cannot be completed here. Everything upstream of the physical hardware (byte-exact wire format via mock TCP server, IPC handler wiring via fake connection, UI-state gating logic, build, typecheck, full test suite) is done and passing.

**A human with physical access to the car must**, before this plan is considered fully done:
1. Run `npm start` in `app/`, connect to the car over tcp100.
2. Click the Shoot button and visually/audibly confirm exactly one ~200ms pulse fires.
3. Toggle the Cooldown checkbox off, confirm the button re-enables immediately after a click (no delay); toggle it on, confirm the button disables for ~300ms after a click.

This does not block starting ticket 02 (aim-control) — aim has its own, separate manual-verification gate (including the direction-sign question) that will need the same kind of hardware session, so it may make sense to batch both tickets' manual verification into one hardware session later.

## Gotchas / notes for next session (02-aim-control)

- The `CarConnectionLike` interface in `carIpcHandlers.ts` now includes `shoot()` — ticket 02 will need to add `setAimAngle(angle: number)` to it the same way, and extend `FakeCarConnection` in `carIpcHandlers.test.ts` similarly (call-count + calls array + optional override impl, matching the `setMovement`/`shoot` pattern).
- `DEVICE_SERVO = 0x02` from ADR-001 was intentionally NOT added in this ticket (out of scope for 01-shoot-control) — ticket 02 adds it.
- The renderer's cooldown-toggle wiring pattern (`shootCooldownActive` flag + `setTimeout` + re-render) is a reasonable template for ticket 02's press-and-hold throttled-repeat timer, though the aim ticket's spec (400ms fixed cadence, active-hold-direction tracking) is a materially different shape — don't over-fit to this ticket's simpler single-shot pattern.
- Aim's UI-mapper (`mapAimControlUiState` or similar) will need angle-bound edge cases (at min, at max, in between) in addition to the connection-state matrix — `mapShootControlUiState`'s test file section is a good template for the connection-state half only.
