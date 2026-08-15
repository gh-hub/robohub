# Requirements: car-movement-light-controls

## Problem
The ACEBOTT control app currently has two redundant "Left Light"/"Right Light" toggle buttons that map to a single shared LED command in the firmware — only one LED exists, and the two-button UI adds no functional value.

The app has no way to drive the car at all yet — only lights and connect/disconnect exist. To control the car's movement, six press-and-hold direction buttons are needed: Forward, Backward, Left (arc turn), Right (arc turn), Rotate Left (pivot turn), and Rotate Right (pivot turn).

## Solution
**Lights:** Replace the two mirrored buttons with a single "Lights" button in the UI. No protocol, IPC, or backend change needed — the single `setLedState` function, `car:set-lights` IPC channel, and shared `lightsOn` boolean all stay exactly as they are. Only the HTML (one button instead of two) and `renderer.ts` event wiring changes.

**Movement:** Add six direction buttons (Forward, Backward, Left, Right, Rotate Left, Rotate Right) arranged in a D-pad layout (the four arc-turn directions in a cross, rotate buttons below). Each button sends the corresponding direction command on `pointerdown`, and sends Stop on `pointerup`, pointer-leave-while-held, window blur, or disconnect — the firmware has no auto-stop watchdog, so motors run indefinitely after a direction command until an explicit Stop arrives.

When a second direction button is pressed while another is held, the new press immediately sends its direction (interrupting the car's motion); a release event only sends Stop if it matches the currently-tracked active direction, preventing stale releases from stopping a newer, still-held button.

Movement buttons are enabled only when `status === "connected" && protocol === "tcp100"`, matching the existing gate for light controls.

## What done looks like
- Single "Lights" button in the HTML and event-wired in `renderer.ts`.
- Six movement buttons (Forward, Backward, Left, Right, Rotate Left, Rotate Right) in D-pad layout, press-and-hold wired, with Stop sent on all safety-trigger events (pointerup, pointerleave, pointercancel, window blur, disconnect).
- Movement command protocol live over TCP:100 (device 0x0C, action CMD_RUN, value byte per direction), verified against the car's actual motor response.
- Interrupt/active-direction-matching semantics working correctly (new direction press overrides, but only the matching release sends Stop).
- Both lights and movement buttons disabled when disconnected, connecting, error, or connected via http80 (which has zero command support).
- All pure functions (frame builder, UI-state mappers) covered by `node:test` unit tests; `CarConnection` command-sending tested against a mock TCP server; IPC handlers tested via `FakeCarConnection`; DOM wiring verified manually against hardware (no unit tests, per existing convention).

## Out of scope
- Firmware changes or reflashing.
- Speed control (firmware defaults to fixed server-side value, no UI slider).
- Diagonal/chorded movement (firmware's Top_Left/Bottom_Left/Top_Right/Bottom_Right values at 0x05-0x08 are intentionally not wired up).
- Keyboard-driven controls (pointer/mouse only).
- Movement commands over http80 protocol (zero command support).
- Preserving/persisting movement or light state across app restarts.
- UI polish/animations beyond the D-pad layout and existing button styling conventions.
- Packaging changes — app continues to run via `npm start` in development mode.

## Environment notes

### Existing lights architecture
A previous plan ("car-lights-control", now in `.gh-workflows/plans/done/20260814_195843-car-lights-control/`) added the binary command-frame protocol and two mirrored light buttons. The architecture established is:

- **Frame format**: `0xFF 0x55 <length> <10-byte payload>`, where payload[6] is action, payload[7] is device, payload[9] is value, all other payload bytes zero-filled.
- **`buildCommandFrame({action, device, value})`** in `app/src/commandFrame.ts`: generic, reusable pure function for this frame shape.
- **`CarConnection.sendCommandFrame(frame)`** in `app/src/carConnection.ts`: sends an already-built frame over the open TCP socket; only works when `status === "connected" && protocol === "tcp100"`; rejects synchronously otherwise (http80 has no command channel).
- **`CarConnection.setLedState(on)`**: convenience wrapper calling `sendCommandFrame(buildCommandFrame({action: CMD_RUN, device: DEVICE_LED, value: on ? 1 : 0}))`, where `CMD_RUN = 0x01` and `DEVICE_LED = 0x05`.
- **IPC channel `car:set-lights`** in `app/src/ipcChannels.ts`, wired through `carIpcHandlers.ts`, `preload.ts`, and `renderer.ts`/`connectionUiState.ts` with gating (`status === "connected" && protocol === "tcp100"`).

### Firmware facts
Movement commands reverse-engineered from the ACEBOTT QD001 reference firmware (both Arduino and Python implementations byte-identical):
- **File references**: `docs/ACEBOTT QD001 - smart car - base/Arduino(Experienced Learner)/5.Program file/7_4APP_control_car/7_4APP_control_car.ino` and `docs/ACEBOTT QD001 - smart car - base/Python/5.Python Program/7.4APPControlCar.py`, specifically the `runModule()` function in both.
- **Movement uses the same frame format** as lights: `action = CMD_RUN (0x01)`, but `device = 0x0C` (motor/movement) instead of `0x05` (LED).
- **Value byte per direction** (all under `action = CMD_RUN`):

| Direction | value | Firmware constant |
|---|---|---|
| Stop | 0x00 | Stop |
| Forward | 0x01 | Forward |
| Backward | 0x02 | Backward |
| Left | 0x03 | Move_Left |
| Right | 0x04 | Move_Right |
| Rotate Left | 0x09 | Contrarotate |
| Rotate Right | 0x0A | Clockwise |

(Note: the firmware also defines Top_Left/Bottom_Left/Top_Right/Bottom_Right at 0x05-0x08, which are intentionally out of scope for this plan.)

### No auto-stop watchdog
The firmware has **no automatic stop-on-timeout** for direct `CMD_RUN` movement commands. Once a direction value is sent, the motors run at that direction indefinitely — the **only way to stop them is an explicit `value = 0x00` (Stop) frame**.

The firmware does have a 3-second `lastDataTimes` timeout, but that **only affects auto-drive modes** (line-follow, obstacle-avoidance, when `st = true`) — it does not apply to direct `CMD_RUN` commands from the app. This is the safety-critical fact that drives the press-and-hold-with-explicit-stops interaction model.
