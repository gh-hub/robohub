# Grill phase: water-gun-control

## Interview summary

The grill phase interview gathered requirements and design decisions for three interconnected features:

1. **Shoot button**: A single-click button to fire the QD005 blaster, with a user-toggleable ~300ms cooldown (default on) to prevent rapid-fire mashing.

2. **Aim up/down buttons**: Press-and-hold buttons to smoothly walk the aim servo through its 1–180° range, with a user-selectable speed dropdown (Fast: 10°/400ms, Slow: 5°/400ms). The 400ms repeat interval matches the firmware's blocking servo-interpolation time, avoiding TCP buffer backlog.

3. **USB status badge**: A small, non-functional informational display (e.g., "USB: Connected" / "USB: Not connected") showing whether the car is plugged in via USB. The badge does NOT enable USB-based commands; it is display-only (the firmware's USB-serial channel is debug-output only, no command parsing).

## Key decisions resolved

### QD005 Protocol

The device codes (0x02 for servo, 0x08 for shoot) and their command semantics were reverse-engineered from the ACEBOTT firmware source (`acebott-esp32-car-shoot-005.ino` and the base QD001 reference code). Both files contain byte-identical `runModule()` handlers for these devices, confirming they are shared ACEBOTT template firmware. The currently-flashed car firmware already supports these codes (confirmed by string cross-reference between the firmware dump and the source files), so no hardware reflash is needed.

**Servo (device 0x02)**: Absolute angle 1–180, mapped internally by firmware to PWM, then smoothly interpolated over ~300–400ms (blocking the TCP loop for that duration). The app tracks angle locally (reset to 90 on connect/disconnect) since the protocol has no state-readback channel.

**Shoot (device 0x08)**: Fixed 200ms pulse per command (firmware ignores the value byte). Fire-and-forget, no stop semantics, also blocking the TCP loop for 200ms per shot.

### Aim interaction model

The user explicitly chose **press-and-hold with throttled repeat** over click-to-step. Why: Real-time feedback matching the existing movement D-pad, and preventing firmware TCP buffer backlog by matching the repeat cadence (400ms) to the firmware's blocking interpolation time (~300–400ms). A simpler click-to-step model was rejected because it lacks feedback and would feel less responsive.

### Aim direction sign: Tentative, unverified

As a starting assumption, Up increases angle and Down decreases angle. This is **explicitly unverified** against the physical hardware — the firmware's internal PWM mapping inverts the angle/direction relationship, and which physical direction the servo horn moves depends entirely on how the horn is mounted. Must be verified during implementation; if backwards, it's a one-line sign flip.

### Aim speed: User-selectable dropdown

The user wanted the step size adjustable at runtime (Fast vs Slow) rather than a single hardcoded value. Both options use the same 400ms repeat cadence to avoid backlog.

### Aim default and reset

App-tracked `aimAngle` starts at 90 (firmware's boot default) and resets to 90 on every connect/disconnect/error, following the precedent established by the app's existing `lightsOn` boolean (which also has no protocol readback).

### Shoot interaction model

Single-click, not press-and-hold (firmware executes a fixed 200ms pulse per frame, regardless of how long a button is held, so press-and-hold has no meaningful effect).

### Shoot cooldown: User-toggleable

The user wanted the cooldown behavior itself to be switchable at runtime (on by default, but turnable off for rapid-fire experiments), rather than a fixed always-on or always-off behavior.

### Gating and enablement

Both Aim and Shoot controls follow the same gate as Lights and Movement: enabled only when `connection.status === "connected" && connection.protocol === "tcp100"`.

### USB status badge

The user initially asked whether USB could replace/disable the Wi-Fi Connect button with equivalent command support. This was ruled out as technically infeasible — the firmware's Serial/UART has no command-parsing code path (verified by source analysis); it is debug-output only. Instead, a non-functional informational badge was added: polling for `/dev/cu.usbserial-*` device nodes every 2 seconds (macOS-only, read-only filesystem check), displaying "USB: Connected" / "USB: Not connected" next to the existing Wi-Fi status. Known limitation: this can false-positive if other USB-serial devices are plugged in (no vendor/product ID filtering, to keep the check lightweight and non-invasive).

### Testing convention

Pure functions (frame builders, UI-state mappers) get unit tests. IPC handlers are tested via `FakeCarConnection`. DOM-level interaction logic (press-and-hold timers, cooldown wiring) is manually verified against real hardware, per the established convention from the movement plan's ADR-001.

### Camera scope boundary

Out of scope — the physical camera module is not connected on this unit.

## Next phase: spec

The spec phase will formalize all of the above into detailed interface specifications, file-change diagrams, code signatures, and unit test outlines. It will identify every file to be created/modified, exactly what changes each file receives, and the test cases required.
