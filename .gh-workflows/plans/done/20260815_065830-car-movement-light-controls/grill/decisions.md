# Decisions: car-movement-light-controls

## Decision: Collapse lights to a single button with no protocol change
Decided: Replace two mirrored "Left Light"/"Right Light" toggle buttons with a single "Lights" button. The wire protocol, `CarConnection.setLedState()`, `car:set-lights` IPC channel, and backend logic all stay exactly as they are — only the HTML (one button instead of two) and renderer event wiring change.

Why: The firmware only ever had one LED and a single shared LED command (device 0x05). The two-button UI was cosmetic and adds no functional value. The existing architecture is already button-count-agnostic at the protocol/IPC/backend layers.

Alternatives rejected: None — this is a pure simplification with zero downside.

---

## Decision: Movement protocol uses device 0x0C with a value-byte table
Decided: Movement commands use the existing frame format (action=CMD_RUN 0x01), but with device=0x0C (motor), and a multi-valued value byte per direction: Stop 0x00, Forward 0x01, Backward 0x02, Left 0x03, Right 0x04, Rotate Left 0x09, Rotate Right 0x0A. The device 0x0C and value table are reverse-engineered from the ACEBOTT QD001 reference firmware's `runModule()` function (byte-identical in both Arduino and Python implementations).

Why: This matches the firmware's actual command protocol. The same frame shape used for lights (action/device/value split) extends naturally to other device types, keeping the command architecture consistent.

Alternatives rejected: None — this is what the firmware implements.

---

## Decision: Press-and-hold interaction with explicit Stop-on-safety-events
Decided: Each direction button sends its command on `pointerdown` and Stop on `pointerup`. Additionally, Stop is sent if the pointer leaves the button bounds while still held (`pointerleave`/`pointercancel` while pressed), if the window loses focus (`blur` event), or if the connection drops (status leaves `connected`+`tcp100`). This covers all scenarios where a held direction might otherwise leave the motors running indefinitely.

Why: The firmware has no auto-stop watchdog for CMD_RUN movement commands — once a direction is sent, motors run forever until an explicit Stop. This is a critical safety fact. The press-and-hold model with multi-trigger Stop events ensures the motors cannot be left running if the user releases the button, the pointer leaves the button, alt-tabs, or the connection drops.

Alternatives rejected:
1. **Mouseup-only stop** (send Stop only on `pointerup`, ignore pointer-leave/blur/disconnect): Leaves the motors running if the user's pointer exits the button bounds while still pressed, or if the window loses focus mid-hold. Safety risk.
2. **Click-to-toggle** (click to start, click to stop): Requires two clicks per motion, is unresponsive to user intent (holding the button does not feel like it controls motion in real-time), and gives no visual feedback that motion is active. Rejected in favor of press-and-hold's directness.

---

## Decision: Interrupt semantics with active-direction matching on Stop
Decided: Track a single `activeDirection: Direction | null` state. On `pointerdown`, set `activeDirection` to the pressed button's direction and send that direction immediately, even if another direction is currently active. On any Stop trigger (pointerup, pointerleave, pointercancel, blur, disconnect), send Stop and clear `activeDirection` only if the event belongs to the currently-active direction — a mismatched or already-cleared stop event is a no-op. This prevents a stale release event from an old button from incorrectly stopping a newer, still-held direction.

Why: If a user presses Forward, then presses Left (without releasing Forward), the car should immediately turn left. If the user then releases the old Forward button, it should NOT send Stop — the user is still holding Left. The active-direction-matching rule enforces this: only the event that matches the currently-tracked active direction can send Stop.

Alternatives rejected: None — this is the only model that makes interrupt-press behavior usable and safe.

---

## Decision: D-pad layout (cross + separate rotate row)
Decided: Forward/Backward/Left/Right arranged in a cross/D-pad shape (Forward at top, Backward at bottom, Left/Right on sides). Rotate Left and Rotate Right as a separate row below the D-pad, aligned below the cross. All buttons placed below the existing Connect/Disconnect and Lights controls in `app/public/index.html`.

Why: The D-pad layout mirrors the car's physical form factor (four directional axes of arc movement) and is familiar to users of game controllers and RC cars. The rotate buttons separate and below clarifies that they are a different class of motion (spinning in place, not arc turns). This was the user's explicit choice over a single horizontal row of six buttons.

Alternatives rejected: Single row of six buttons (Forward, Backward, Left, Right, Rotate Left, Rotate Right all in a line) — less intuitive spatial mapping to the car's motion model.

---

## Decision: One parameterized IPC channel for movement (not N separate channels)
Decided: Add one channel `car:set-movement` carrying a direction string (`"forward" | "backward" | "left" | "right" | "rotate-left" | "rotate-right" | "stop"`), mapped to the numeric value inside `CarConnection.setMovement()` or a mapping function. This mirrors the lights plan's pattern of one parameterized channel (`car:set-lights` with an `on` boolean), not one channel per action.

Why: Keeps the IPC surface minimal and composable. A single parameterized channel is easier to test, document, and extend than N separate channels. This pattern was already established in the lights plan and is proven to work.

Alternatives rejected: Six separate channels (`car:move-forward`, `car:move-backward`, `car:move-left`, etc.) — more verbose, harder to manage, and no functional advantage.

---

## Decision: Reuse gating rule from lights (connected + tcp100)
Decided: Movement buttons are enabled only when `status === "connected" && protocol === "tcp100"`, identical to the existing gate for light controls. Gating is implemented as a pure UI-state-mapping function (e.g., `mapMovementControlUiState` in `connectionUiState.ts`), following the pattern established by `mapLightControlUiState`.

Why: Movement commands only work over TCP:100 (the command channel). HTTP:80 has zero command support, same as lights. Disabling buttons in all other states (disconnected, connecting, error, http80) prevents user confusion and avoids rejected commands. The pure function pattern keeps gating logic testable and decoupled from the renderer.

Alternatives rejected: None — this is the established pattern and the correct safety model.

---

## Decision: Testing approach — pure functions and mock TCP server only; DOM wiring manual
Decided: 
- **Movement value-mapping and frame construction**: pure function unit tests (`node:test` input/output pairs), same style as existing frame-builder tests. For each direction, assert the exact resulting byte sequence from `buildCommandFrame`.
- **`CarConnection.setMovement()`**: tested against a mock TCP server, asserting exact bytes sent for each direction while connected via tcp100, and asserting rejection when disconnected or on http80.
- **IPC handler layer (`handleSetMovement`)**: tested via `FakeCarConnection`, asserting the handler calls `setMovement` with the right direction and rejects when the underlying call rejects.
- **Renderer UI-state mapping function**: input/output-pair unit tests, same style as `connectionUiState.test.ts`.
- **NOT unit tested**: pointer event wiring (pointerdown/pointerup/pointerleave/pointercancel), blur handling, active-direction tracking, and the Stop-sending logic in `renderer.ts` itself. These are verified manually against real hardware during implementation, per existing convention (DOM wiring is not unit tested; only hardware behavior confirms correctness).

Why: Pure functions are deterministic and testable. `CarConnection` already has a proven mock-TCP-server testing pattern (from lights). IPC handlers also have proven `FakeCarConnection` tests (from lights). DOM wiring is inherently tied to browser behavior and the real hardware; unit tests for event handlers would be coupling-heavy and fragile. The manual verification step ensures the motors actually stop when expected, which is the safety-critical behavior. This approach mirrors the lights plan's testing decisions exactly.

Alternatives rejected: None — this pattern is proven and established.

Special note: Flag manual verification of **interrupt semantics** (pressing a new direction while another is held, releasing the wrong/old button without releasing the new one) as an explicit manual test case during implementation — it is the one genuinely new piece of stateful logic in this plan.
