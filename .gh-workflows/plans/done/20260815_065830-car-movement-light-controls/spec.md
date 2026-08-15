## Problem Statement

The ACEBOTT control app's light controls currently show two separate "Left Light"/"Right Light" buttons, even though the car has only one LED and both buttons drive the exact same wire command — the two-button UI implies independent control that doesn't exist, which is confusing.

More importantly, the app has no way to actually drive the car. Today it can only connect/disconnect and toggle the light; there is no way to move the car forward, backward, turn, or spin in place. An operator watching the car has no controls to make it go anywhere.

## Solution

**Lights:** Collapse the two mirrored light buttons into a single "Lights" button. This is a pure UI simplification — the underlying command is already shared, so no protocol, IPC, or backend change is needed.

**Movement:** Add a D-pad of six press-and-hold direction buttons (Forward, Backward, Left, Right, Rotate Left, Rotate Right) below the existing controls. Holding a button drives the car in that direction; releasing it (or the pointer leaving the button, the window losing focus, or the connection dropping) sends an explicit Stop. This design is forced by a firmware safety fact: the car has no watchdog for direct movement commands, so once a direction is sent, the motors run forever until an explicit Stop arrives. Pressing a new direction while one is already held immediately overrides it (interrupt semantics), and only a release that matches the currently-held direction is allowed to send Stop — so releasing a stale, already-overridden button never stops the car's current motion.

Movement commands travel over the same TCP:100 binary command-frame protocol already used for lights, extended with a new device code (motor, 0x0C) and a value byte per direction. Both lights and movement controls are enabled only on a live TCP:100 session, matching the existing gating rule (HTTP:80 has zero command support).

## User Stories

1. As a car operator, I want a single "Lights" button instead of two functionally-identical "Left Light"/"Right Light" buttons, so the UI doesn't imply independent control that doesn't exist.
2. As a car operator, I want clicking "Lights" to toggle the car's LED on/off exactly as before, so the simplification doesn't change what the button does.
3. As a car operator, I want to press and hold a Forward button to drive the car forward, so I have direct, real-time control over its motion.
4. As a car operator, I want to press and hold Backward, Left, Right, Rotate Left, and Rotate Right buttons to move or turn the car in each of those ways, so I can fully maneuver it.
5. As a car operator, I want the car to stop the instant I release a direction button, so it never keeps driving after I let go.
6. As a car operator, I want the car to stop if my pointer slides off a direction button while still pressed (e.g. dragging past its edge), so an accidental drag doesn't leave the motors running.
7. As a car operator, I want the car to stop if I alt-tab or otherwise lose window focus while holding a direction button, so it doesn't keep moving while I'm not watching the app.
8. As a car operator, I want the car's held direction to be abandoned (and no runaway command left active) if the connection drops while I'm holding a direction button, so a Wi-Fi hiccup can't leave the motors spinning uncontrolled.
9. As a car operator, I want to press a new direction while already holding another, and have the car immediately switch to the new direction, so I can make quick directional corrections without first releasing the old button.
10. As a car operator, when I release an old button after already having pressed a new one, I don't want the car to stop, so my continued hold on the new direction isn't interrupted by a stale release.
11. As a car operator, I want the movement buttons arranged in a D-pad (a cross for Forward/Backward/Left/Right, with Rotate Left/Rotate Right below), so the layout matches the car's physical directions and feels intuitive.
12. As a car operator, I want both light and movement buttons disabled whenever I'm not connected via TCP:100 (disconnected, connecting, error, or connected over the read-only HTTP:80 fallback), so I'm never misled into thinking a command will do something it can't.
13. As a developer, I want the movement direction-to-value mapping and frame construction covered by pure-function unit tests, so protocol correctness is verified without needing the physical car.
14. As a developer, I want `CarConnection`'s movement-sending method tested against a mock TCP server, so I can verify exact wire bytes per direction and rejection behavior (disconnected, http80) without hardware.
15. As a developer, I want the movement IPC handler tested via a fake connection, so the handler's contract (call-through, rejection propagation) is verified independent of Electron and real sockets.
16. As a developer, I want the movement and lights gating logic expressed as pure UI-state-mapping functions, so enabled/disabled behavior across every connection state is exhaustively unit-testable.

## Implementation Decisions

**Lights (UI-only change):**
- `app/public/index.html`: replace the two `light-left-button`/`light-right-button` elements with a single `Lights` button.
- `renderer.ts`: replace the two click listeners and `renderLights()`'s dual-button update with a single button's worth of wiring, still driven by the existing mirrored `lightsOn` boolean and `window.carAPI.setLights()`.
- No change to `commandFrame.ts`, `carConnection.ts` (`setLedState`), `ipcChannels.ts`, `carIpcHandlers.ts`, `preload.ts`, or `connectionUiState.ts`'s `mapLightControlUiState` — all already button-count-agnostic.

**Movement (new protocol + feature), per ADR-001 in this plan's grill output:**
- `commandFrame.ts`: add a device constant for motor (`DEVICE_MOTOR = 0x0C`) alongside the existing `DEVICE_LED`, and a value table/mapping from a direction identifier to its numeric value byte (Stop 0x00, Forward 0x01, Backward 0x02, Left 0x03, Right 0x04, Rotate Left 0x09, Rotate Right 0x0A), following the file's existing constant style. `buildCommandFrame()` itself is unchanged — it already generically accepts any action/device/value combination.
- `carConnection.ts`: add `setMovement(direction)`, a convenience wrapper over `sendCommandFrame()` mirroring `setLedState()` exactly — same gating (`status === "connected" && protocol === "tcp100"`, else synchronous rejection before any write), same use of `buildCommandFrame({ action: CMD_RUN, device: DEVICE_MOTOR, value: <mapped> })`.
- `ipcChannels.ts`: add `CAR_SET_MOVEMENT_CHANNEL = "car:set-movement"`.
- `carIpcHandlers.ts`: extend `CarConnectionLike` with `setMovement(direction)`; add `handleSetMovement(direction)` to `CarIpcHandlers`, following the exact resolve-once-initiated / reject-on-invalid-state contract already used by `handleSetLights`.
- `preload.ts`: add `setMovement` to the `CarApi` surface and the inlined channel constant (per this file's existing no-local-imports constraint), exposed via `contextBridge`.
- `connectionUiState.ts`: add a pure `mapMovementControlUiState(connection)` function mirroring `mapLightControlUiState` — enabled only when `status === "connected" && protocol === "tcp100"`. (Movement has no analogous on/off "state label" the way lights does — a button is either enabled or not; no additional per-direction display state is needed.)
- `app/public/index.html`: add six movement buttons in a D-pad layout — Forward/Backward/Left/Right arranged in a cross, Rotate Left/Rotate Right in a row below the cross, all placed below the existing Connect/Disconnect and Lights controls.
- `renderer.ts`: wire `pointerdown` on each movement button to send that direction immediately (interrupting whatever was previously active) and track a single `activeDirection: Direction | null` slot. Wire `pointerup`, `pointerleave`, `pointercancel` on each button, and a single `window.blur` listener, to send Stop — but only when the triggering event's direction matches the currently-tracked `activeDirection` (a mismatched or already-null event is a no-op); on a match, send Stop and clear `activeDirection`. Also clear `activeDirection` (without attempting to send, since the socket is already gone or about to be) whenever the connection status transitions away from `connected`+`tcp100` in the existing `onStatus` handler — this is a local state reset, not a new Stop-sending path, since `CarConnection.setMovement()` already rejects synchronously once the session is no longer live.
- The IPC contract for movement carries a direction identifier that includes `"stop"` as one of its values (not a separate boolean or separate channel), per the grill decision to use one parameterized channel (`car:set-movement`) rather than one channel per direction — this exactly mirrors the `car:set-lights` pattern (one channel, one parameter) already established for lights.
- No changes to the base frame format (`0xFF 0x55 <len> <payload>`, action/device/value offsets) — this plan only adds a new device code and its value table, consistent with `buildCommandFrame()`'s documented intent to be reusable across future device types.

**Schema/API summary:**
- New IPC channel: `car:set-movement`, parameter: a direction string (`"forward" | "backward" | "left" | "right" | "rotate-left" | "rotate-right" | "stop"`), return: `Promise<void>`, same resolve/reject contract as `car:set-lights`.
- New wire values under existing `action = CMD_RUN (0x01)`, new `device = 0x0C`: value byte per direction as listed above.
- No changes to any existing channel, frame shape, or the lights command.

## Testing Decisions

Testing follows the exact pattern already proven by the lights feature in this codebase — pure functions and network-boundary mocks are unit tested; DOM/pointer-event wiring is not.

- **Frame construction / value mapping** (`commandFrame.ts`): `node:test` input/output pairs, extending the existing `commandFrame.test.ts` style — for each direction, assert the exact resulting byte sequence from `buildCommandFrame({ action: CMD_RUN, device: DEVICE_MOTOR, value: ... })`, matching how `commandFrame.test.ts` already asserts exact LED-on/LED-off byte sequences.
- **`CarConnection.setMovement()`**: tested against a mock TCP server, following `carConnection.test.ts`'s existing `captureServerSocket()`/mock-server pattern used for `setLedState()` — assert exact bytes received for each direction while connected on tcp100, and assert synchronous rejection (no write) when disconnected or on http80, mirroring the existing `setLedState()` rejection tests.
- **IPC handler layer** (`handleSetMovement`): tested via `FakeCarConnection` (extended with a `setMovement`/`setMovementCalls` tracking member), following `carIpcHandlers.test.ts`'s existing `handleSetLights` test shape — asserts the handler calls through with the right direction and propagates rejection.
- **Renderer UI-state mapping** (`mapMovementControlUiState`): input/output-pair unit tests in `connectionUiState.test.ts`'s existing style, covering every combination of connection status/protocol against enabled/disabled.
- **Explicitly NOT unit tested**: pointer event wiring (`pointerdown`/`pointerup`/`pointerleave`/`pointercancel`), `window.blur` handling, `activeDirection` tracking, and the Stop-sending/interrupt logic in `renderer.ts` itself — consistent with the existing convention that DOM wiring in this codebase is not unit tested. This is verified manually against real hardware during implementation. Per the grill decisions, interrupt semantics specifically (press a new direction while another is held; release the old button without releasing the new one) must be flagged as an explicit manual test case, since it's the one genuinely new piece of stateful renderer logic in this plan.
- **Lights consolidation**: no new tests needed at the protocol/IPC/backend layers (nothing there changed). The renderer's single-button click wiring is DOM-level and, per the same existing convention, not unit tested — verified manually.

## Out of Scope

- Firmware changes or reflashing.
- Speed control (firmware defaults to a fixed server-side value; no UI slider).
- Diagonal/chorded movement (firmware's Top_Left/Bottom_Left/Top_Right/Bottom_Right values at 0x05-0x08 are intentionally not wired up).
- Keyboard-driven controls (pointer/mouse only).
- Movement commands over the http80 protocol (zero command support there).
- Preserving or persisting movement or light state across app restarts.
- UI polish/animations beyond the D-pad layout and existing button styling conventions (e.g. no pressed/active visual state beyond native browser button styling).
- Packaging changes — the app continues to run via `npm start` in development mode.

## Further Notes

- **Live-hardware verification risk**: as with the prior lights plan, this development environment likely has no network reachability to the physical QD001 car, so the reverse-engineered device/value table (device 0x0C, values 0x00-0x04/0x09-0x0A) can be verified byte-for-byte against the documented firmware source and covered by mock-server tests, but cannot be confirmed to actually move the real car's motors from within this environment. This mirrors the open risk the previous plan flagged and left as a manual step for the user once real hardware is reachable — it should be flagged the same way here rather than treated as a blocker.
- **Connection-drop-while-held edge case**: the grill decisions say a connection drop should "send Stop if still possible." Resolved here as: no additional Stop-sending code path is needed beyond what already exists, since `CarConnection.setMovement()` already rejects synchronously once the session leaves `connected`+`tcp100` (there is no socket left to write to). The renderer's job on a status transition away from that state is only to clear its local `activeDirection` tracking so a later stray pointer event can't misfire — not to attempt a network call that would just reject. This is a design clarification synthesized from the grill output, not an open question requiring a stop-and-ask.
- No other genuine ambiguities were found — the grill output (decisions.md, ADR-001, glossary) resolves layout, protocol, gating, interrupt semantics, and testing approach in enough detail to proceed directly to implementation.
