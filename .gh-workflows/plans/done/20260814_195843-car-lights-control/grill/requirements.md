# Requirements: car-lights-control

## Problem

The user owns an ACEBOTT QD001 smart car with two physical LED light modules (one on each side). They want to control these lights from the existing Electron desktop app, adding a new control layer to the already-built connect/status functionality. Currently, the app only connects and shows connection status; it has no way to send commands to the car yet.

## Solution

Extend the existing Electron app (built in the `acebott-control-app` plan) with the ability to turn the car's left and right LED lights on and off. The app will:

- Show two separate toggle buttons in the UI, labeled "Left Light" and "Right Light"
- Both buttons control the same underlying hardware LED command (since the car's firmware only exposes one shared on/off for both LEDs), so both buttons always display the same state (mirrored behavior)
- Track the toggled state locally in the app (optimistic/app-tracked state, not queried from hardware)
- Reset both toggles to "off" whenever the app connects or reconnects to the car
- Disable both toggle buttons when the car is not connected or when the connection is over the HTTP:80 fallback protocol (only enable them for active TCP:100 protocol connections)
- Send binary command frames over the existing TCP:100 socket using the established binary protocol

The main-process car-connection layer will be extended with the ability to build and send binary command frames; the renderer will trigger them via IPC messages, maintaining the established architecture where the main process owns all socket I/O.

## Done looks like

- Two toggle buttons ("Left Light" and "Right Light") appear in the app UI below the existing Connect/Disconnect button
- Both buttons are disabled (grayed out) when the car is not connected
- Both buttons are disabled when connected over HTTP:80 protocol
- Both buttons are enabled only when connected over TCP:100 protocol
- Clicking either button sends the LED-on or LED-off command over the TCP socket to the car
- Both buttons always display the same state (mirrored) because they control the same hardware command
- When a new connection is established, both toggles immediately show "off" state
- When a connection is lost, both toggles become disabled and reset to "off"
- The binary command-sending capability is tested (unit tests for frame construction and IPC handler wiring)

## Out of scope

- Firmware changes or reflashing of any kind — control must work using only the existing WiFi/TCP:100 protocol as-is
- Independent left/right LED control via separate hardware addresses — this would require firmware changes; the current protocol does not support it
- Hardware state readback or querying — the protocol has no query/response channel; all state is optimistic/app-tracked
- Preserving LED state across app restarts or reconnects — state resets to "off" on every new connection
- HTTP:80 fallback protocol LED support — the HTTP firmware has zero LED capability, so light controls are TCP:100 only
- UI polish, multi-screen flows, or advanced features — this is a minimal add-on to the existing single-window app
- Packaging changes — the app continues to run in development mode via `npm start`

## Environment notes

### Key hardware and protocol facts

1. **Two physical LEDs exist**, wired to separate ESP32 GPIO pins (GPIO2 and GPIO12). Source comments in `docs/ACEBOTT QD001 - smart car - base/Python/5.Python Program/3.1Turn_on_LED.py` say `left_led = Pin(2)`, `right_led = Pin(12)`, but the official ACEBOTT tutorial video narration (Section 2-2, "Lighting Up the SmartCar") states the opposite: left LED on pin 12, right LED on pin 2. Exact mapping is **unconfirmed** and low-stakes since both are driven identically by the current protocol.

2. **The WiFi/TCP:100 binary protocol's LED command only controls both LEDs together — no independent left/right addressing exists over the wire.** Confirmed identical in every firmware variant reviewed:
   - `docs/ACEBOTT QD001 - smart car - base/Arduino(Experienced Learner)/5.Program file/7_4APP_control_car/7_4APP_control_car.ino` (lines ~598-602: `case 0x05: { digitalWrite(LED_Module1,val); digitalWrite(LED_Module2,val); } break;`)
   - `docs/ACEBOTT QD005 Shooting Car V1 Tutorial V2.9/Arduino(Experienced Learner)/ACEBOTT QD005 ESP32 Shooting Car A/2.Program file/acebott-esp32-car-shoot-005/acebott-esp32-car-shoot-005.ino` (lines ~534-535)
   - `docs/ACEBOTT QD005 Shooting Car V1 Tutorial V2.9/Arduino(Experienced Learner)/ACEBOTT QD005 ESP32 Shooting Car B/2.Program file/acebott-esp32-car-body/acebott-esp32-car-body.ino` (lines ~434-435)
   
   Device code `0x05` = LED, taking a single `val` byte (0=off, nonzero=on) applied to both pins simultaneously.

3. **No state-readback/query channel exists in the protocol.** `CMD_GET` (value 2) is defined as a constant but never handled in the firmware's command switch (dead code) — confirmed in `7_4APP_control_car.ino`'s `parseData()` function, which only handles `CMD_RUN`, `CMD_STANDBY`, `CMD_TRACK_1/2`, `CMD_AVOID`, `CMD_FOLLOW` — no `CMD_GET` case. Nothing in the TCP receive loop ever writes data back to the client over the socket (only debug `Serial.write`/`Serial.println` over USB serial, not the network). This was independently re-confirmed against the user's own real hardware via flash-dump analysis at `tools/qd001-probe/dumps/` (produced via `esptool.py` — venv and requirements already set up in `tools/qd001-probe/`), grepping `app0_strings.txt` for status/state/query-related strings found nothing beyond generic ESP-IDF/lwIP framework internals.

4. **The user's physical car's flash dump confirms it speaks the TCP:100 binary protocol** (not the HTTP:80 fallback firmware): SSID `ESP32-CAR`, firmware version string `Firmware Version is 0.12.21`, and `[Client connected]`/`[Client disconnected]` log lines matching `7_4APP_control_car.ino`'s protocol family exactly, found in `tools/qd001-probe/dumps/app0_strings.txt`. This settles an open question the previous plan (`acebott-control-app`) deliberately left unconfirmed. Note: the dump also contains camera-related strings not present in the plain `7_4APP_control_car.ino` example, meaning the actual running firmware may be a variant that bundles camera + car control and might not be byte-identical to the example source — flagged as needing live verification during implementation.

5. **The HTTP:80 fallback firmware has zero LED support** — reviewed `docs/ACEBOTT QD001 - smart car - base/Python/5.Python Program/7.3Web_control_car.py`, which only handles `/Car?move=` requests (movement), nothing else.

6. **Reconstructed binary frame format** (from `7_4APP_control_car.ino`'s `RXpack_func()`/`parseData()`, and the byte-identical parsing logic in `docs/ACEBOTT QD001 - smart car - base/Python/5.Python Program/7.4APPControlCar.py`):
   - Frame = `0xFF, 0x55, <lengthByte>, <payload...>`
   - The receiver's `buffer` array is populated starting at index 3 for the first payload byte
   - `parseData()` reads `action` from `buffer[9]`, `device` from `buffer[10]`, and `val` from `buffer[12]`
   - `buffer[11]` is written but never read anywhere in any firmware variant checked — appears to be unused/reserved padding
   - For a payload of exactly 10 bytes (filling buffer[3..12]), `lengthByte = 0x0A` (10)
   - The receiver decrements a length counter once per payload byte and triggers `parseData()` exactly when it reaches 0
   - To send the LED-on command: `action = CMD_RUN (0x01)`, `device = 0x05`, `val = 0x01`; LED-off: same with `val = 0x00`
   - The 6 bytes at buffer[3..8] and the 1 byte at buffer[11] are unvalidated by the parser in every source variant reviewed and can likely be zero-filled, but **this needs live confirmation pass against the real car during implementation**, since the compiled firmware isn't guaranteed byte-identical to the example source (see fact 4 above).

7. **`app/src/carConnection.ts`'s existing `ConnectionState` type already has a `protocol: 'tcp100' | 'http80' | null` field** — directly usable to gate light controls to tcp100-only sessions without any schema change.

### Repository state

- The app code lives in `app/` (established by the `acebott-control-app` plan)
- `app/src/carConnection.ts` defines the main-process car-connection class with `ConnectionState` type including protocol field
- `app/src/ipcChannels.ts` defines IPC channel names
- `app/src/carIpcHandlers.ts` handles IPC wiring for connect/disconnect
- `app/src/preload.ts` exports `window.carAPI` to the renderer
- `app/src/renderer.ts` and `app/src/connectionUiState.ts` handle the renderer UI and state mapping
- Testing convention: Node's built-in `node:test` + `node:assert`, mock TCP/HTTP servers for connection-module tests, plain-function tests for IPC handler wiring, pure-function tests for UI state mapping

