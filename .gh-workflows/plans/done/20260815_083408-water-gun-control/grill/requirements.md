# Requirements: water-gun-control

## Problem

The ACEBOTT QD001 car control Electron app (`app/`) already has working Wi-Fi (TCP:100) connect/disconnect, LED lights control, and 6-direction movement control. The user wants to connect the QD005 water gun / water ball launcher attachment, which adds two new functions: **shoot** (fire the blaster trigger) and **aim** (up/down movement of an aiming servo). Additionally, the user requested a small informational feature: a USB-connection status badge.

## What we're building

1. **Shoot button**: A single-click button that fires the blaster over an active tcp100 connection, with a toggleable ~300ms cooldown (default on) to prevent rapid-fire button mashing.

2. **Aim up/down buttons**: Press-and-hold buttons that smoothly walk the aim servo through its 1–180° angle range. The user selects a speed via a dropdown: "Fast" (10° per step, repeated every 400ms) or "Slow" (5° per step, repeated every 400ms). The buttons are disabled at the upper (180°) and lower (1°) bounds respectively.

3. **USB status badge**: A small, purely informational display (e.g., "USB: Connected" / "USB: Not connected") shown next to the existing Wi-Fi connection status. This does NOT enable any car commands over USB and does NOT replace or disable the existing Wi-Fi Connect button in any way. Detection is via polling the filesystem for `/dev/cu.usbserial-*` device nodes every 2 seconds (macOS-specific, read-only, no port opened).

All three new controls are gated identically to the existing lights/movement controls: enabled only when `connection.status === "connected" && connection.protocol === "tcp100"`.

## Definition of done

- Shoot button sends exactly one fire command per click, with the cooldown toggle working (enabled / disabled).
- Aim buttons respond to press-and-hold, incrementing/decrementing the tracked angle by the selected step size (Fast/Slow) on a 400ms cadence while held.
- Aim angle is clamped to 1–180 (firmware's supported range); Up/Down buttons disable at respective bounds.
- All QD005 controls are gated (enabled only when connected+tcp100).
- USB status badge appears on-screen and updates in real time, reflecting `/dev/cu.usbserial-*` presence.
- The entire implementation is manually verified working against the real physical car hardware (not just unit tests), since the QD005 protocol has never been live-tested before this plan.

## Environment notes

1. **Existing binary command-frame protocol**: Frames are `0xFF 0x55 <length=0x0A> <10-byte payload>`, with `payload[6]=action`, `payload[7]=device`, `payload[9]=value`, everything else zero-filled. Built by `buildCommandFrame()` in `app/src/commandFrame.ts`. `action = CMD_RUN = 0x01` for all device commands. Existing device codes: `DEVICE_LED = 0x05`, `DEVICE_MOTOR = 0x0c`.

2. **Firmware already supports the QD005 commands** — no reflash needed. The currently-flashed firmware was confirmed to support device codes 0x02 (aim servo) and 0x08 (shoot) by cross-referencing unique strings from the actual firmware dump (`tools/qd001-probe/dumps/app0_strings.txt`) against the QD005 and QD001 base firmware `.ino` sources. Both firmware sources contain byte-identical `runModule()` code for these two devices, confirming shared ACEBOTT template firmware baked into the whole product family.

3. **New device codes** (reverse-engineered from firmware source):
   - `device = 0x02` → **aim servo** (`Servo_Move(val)`, GPIO 26). `val` is an absolute angle 1–180, mapped by firmware to PWM, then smoothly interpolated over ~300–400ms (blocking the TCP loop for that duration).
   - `device = 0x08` → **shoot** (GPIO 32). Firmware does `digitalWrite(Shoot_PIN, HIGH); delay(200); digitalWrite(Shoot_PIN, LOW);` — a fixed 200ms pulse (also blocking TCP loop). The value byte is ignored.

4. **USB-serial is a separate, non-command channel** — the firmware's `Serial` object (USB-serial) is debug output only; there is no code path that parses command frames off Serial/UART. Commands only work over Wi-Fi TCP:100. USB connection is display-only in this app; no commands can be sent over it with the current firmware.

5. **USB device node detection** (macOS-only): `ls /dev/cu.usbserial-*` identifies connected USB-serial devices by naming pattern, but does not distinguish this car from other USB-serial devices (accepted false-positive risk; the badge is informational only, not functional).

## Out of scope

- **Camera function** (only on QD002/QD005 bundles): The physical camera module is not connected on this unit; no camera support is needed or tested.
- **USB as a control channel**: No commands can be sent to the car over USB with the current firmware, and adding that support is out of scope for this plan.
