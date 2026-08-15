# Session End-State: Grill Phase

**Phase:** grill  
**Started:** 2026-08-14 19:59:18  
**Finished:** 2026-08-14 23:47:32  

## What was gathered

### 7 Key Decisions

1. **No firmware changes — WiFi-only control**: Control must work using only the existing WiFi/TCP:100 protocol as-is. User explicitly rejected firmware modifications.

2. **Two toggle buttons, mirrored behavior**: UI shows separate "Left Light" and "Right Light" buttons, but both send the same LED command since hardware doesn't support independent control.

3. **App-tracked (optimistic) state, not hardware-read**: Button state reflects what the app last commanded, not queried from hardware (protocol lacks state-readback channel).

4. **Reset assumed state to "off" on every connect/reconnect**: Both toggles display "off" immediately after any fresh connect, regardless of prior session state.

5. **UI placement and connection-gating**: New buttons appear below the existing Connect/Disconnect button, disabled when car is not connected.

6. **Light control gated to the tcp100 protocol**: Buttons only enabled for TCP:100 connections, not HTTP:80 fallback (which has no LED support).

7. **New command-sending capability in main-process car-connection layer**: Extend `CarConnection` class to build/send binary frames over TCP socket via new IPC channels, maintaining established architecture.

### 7 Key Facts (from firmware source + hardware flash dump)

1. Two physical LEDs on GPIO2 and GPIO12; exact left/right mapping unconfirmed (source comments vs. video narration disagree), low-stakes since both driven identically.

2. TCP:100 protocol's LED command (device code 0x05) controls both LEDs together — no independent left/right addressing over wire.

3. No state-readback/query channel exists; `CMD_GET` is dead code in firmware; TCP stream is one-directional (car never sends data back).

4. User's real QD001 hardware confirmed to speak TCP:100 (flash dump analysis: `tools/qd001-probe/dumps/app0_strings.txt` shows matching firmware version `0.12.21` and protocol markers); may include camera firmware variant not in example source.

5. HTTP:80 fallback firmware has zero LED support — movement only.

6. **Reconstructed binary frame format** (documented in ADR-001.md): Header `0xFF 0x55`, length byte `0x0A`, 10-byte payload with action at [6], device at [7], value at [9]. LED-on: `val=0x01`, LED-off: `val=0x00`. Padding bytes [0-5] and [8] unvalidated by parser, can be zero-filled. **Not yet live-tested against real car** — needs confirmation during implementation.

7. `app/src/carConnection.ts` already has `ConnectionState.protocol: 'tcp100' | 'http80' | null` field — no schema change needed for decision 6 (gating).

### Glossary

Four terms defined: **Left Light / Right Light**, **tcp100 protocol**, **Mirrored toggle**, **Optimistic / app-tracked state**.

### ADR

**ADR-001**: Binary Command Frame Format for TCP:100 Protocol. Documents the canonical frame structure for all device commands (LED here, movement/buzzer/servo in future). Status: Accepted. Emphasizes that the format was reverse-engineered from source, not live-tested yet — implementation phase will serve as first confirmation against real hardware.

## What's next

The **spec phase** will:
- Design the exact IPC channel names and message shapes for light-control requests/responses
- Define the new UI state transitions and component structure
- Plan the ticket breakdown (which changes go in which tickets)
- Define acceptance criteria and test strategy
- Flag any gotchas or dependencies discovered during spec work

## Environment notes

- Previous plan `acebott-control-app` (done/20260814_174351-acebott-control-app/) built the base Electron app with connect/disconnect button
- App code in `app/`, test convention: `node:test` + `node:assert`
- Flash-dump analysis tooling at `tools/qd001-probe/` (venv + esptool.py already set up)
- Firmware source at `docs/ACEBOTT QD001 - smart car - base/Arduino(Experienced Learner)/...` and `docs/ACEBOTT QD005 Shooting Car V1 Tutorial V2.9/Arduino(Experienced Learner)/...`

