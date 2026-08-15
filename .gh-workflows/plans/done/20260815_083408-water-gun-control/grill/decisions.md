# Decisions: water-gun-control

## Decision: Aim (Up/Down) interaction model

Decided: Press-and-hold, matching the existing movement D-pad's interaction feel — NOT click-to-step, which was the initially recommended (safer, simpler) alternative.

Why: User explicitly chose press-and-hold over the recommended click-to-step option, prioritizing a consistent feel with the existing movement controls over the simplicity of discrete clicks.

Alternatives rejected: Click-to-step (each click sends one fixed-degree nudge) — this was recommended first because the firmware's blocking ~300-400ms interpolation per command means naive rapid press-and-hold repeats would queue/backlog. Rejected by the user in favor of press-and-hold; the backlog risk is mitigated instead by the throttled-repeat decision below.

## Decision: Aim hold cadence (repeat rate while held) is user-selectable via a speed dropdown

Decided: Add a speed dropdown/select control next to the Up/Down aim buttons, offering two options: "Fast" = 10° per step, repeated every 400ms while held, and "Slow" = 5° per step, repeated every 400ms while held. Whichever option is currently selected in the dropdown governs the held-button's repeat behavior. Default selection: Fast.

Why: The 400ms interval in both options matches the firmware's own blocking interpolation time per command (~300-400ms), so only one angle command is ever in flight — this avoids flooding/backlogging the firmware's TCP receive loop discovered as a risk in the requirements. The user wanted the step size adjustable at runtime rather than fixed to one value, hence the dropdown instead of a single hardcoded step size.

Alternatives rejected: A single fixed step size with no user choice (either just 10°/400ms or just 5°/400ms alone) — user wanted both available via a runtime selector instead of picking one permanently.

## Decision: Aim angle bounds and clamping

Decided: The app-tracked aim angle is clamped to the firmware's supported range of 1–180 (inclusive). The Up/Down buttons become disabled when the tracked angle is already at the respective bound (180 for Up, 1 for Down) — matching the existing disabled-button UX convention used elsewhere in the app (e.g. gating movement/lights buttons by connection state).

Why: The firmware's `map(angles, 1, 180, 130, 70)` will extrapolate the PWM value outside its intended 70-130 safe range if given a value outside 1-180, risking over-driving the servo. Clamping app-side prevents ever sending an out-of-range value. The user's initial "no limits" phrasing was clarified during the interview to mean "use the full 1-180 range with no additional narrowing below that firmware-supported range" — not "skip clamping entirely."

## Decision: Aim direction sign (Up vs Down mapping to angle increase/decrease) — tentative, needs live verification

Decided: As a starting assumption, clicking/holding Up increases the app-tracked angle value, and Down decreases it. This is explicitly flagged as unverified against the physical hardware — the firmware's `Servo_Move()` inverts the relationship internally (`map(angles, 1, 180, 130, 70)`: angle 1 → PWM 130, angle 180 → PWM 70), and which physical direction (barrel tilting further up vs down) that produces on the real QD005 mount is unknown until tested live.

Why: There's no way to determine the correct sign from static firmware analysis alone — it depends on how the servo horn is physically mounted on this specific unit. Needs hardware-in-hand verification during the implement phase; if backwards, this is a one-line sign flip in the increment logic, not a redesign.

Alternatives rejected: None — this is a placeholder decision explicitly pending live verification, not a closed decision between real alternatives.

## Decision: Aim default/reset angle

Decided: The app tracks a local `aimAngle` value (no protocol readback exists to query the real position — see requirements' environment notes). It starts at 90 (matching the firmware's own boot-time default) and resets to 90 on every fresh connect, disconnect, or error — the same reset points and rationale already used for the existing `lightsOn` app-tracked boolean in `app/src/renderer.ts` (see that file's `window.carAPI.onStatus` handler, which resets `lightsOn = false` on `"connected" | "disconnected" | "error"`, deliberately excluding the transient `"connecting"` state).

Why: Mirrors the established precedent for app-tracked state that has no hardware readback, ensuring the app never carries over a stale angle assumption from a previous session across reconnects.

Alternatives rejected: None discussed — directly reused the existing lights precedent.

## Decision: Shoot button interaction model

Decided: Single-click button (not press-and-hold). Each click sends exactly one command frame (`action=CMD_RUN`, `device=0x08`, value byte = 0x00 by convention since the firmware ignores it). No explicit "stop" command is needed or sent for shoot, unlike movement's press-and-hold model — the firmware's 200ms pulse is self-completing once triggered.

Why: The firmware handler for device 0x08 is fire-and-forget (a fixed-duration blocking pulse the firmware manages internally), unlike motor movement which runs indefinitely until an explicit Stop is sent (per the existing movement ADR's safety model). There is nothing analogous to hold-to-fire in the firmware — one frame triggers exactly one 200ms pulse regardless of how long any button might be held, so click-based is the only interaction model that matches the actual firmware behavior.

Alternatives rejected: Press-and-hold (rejected as meaningless for this device — the firmware ignores duration/value and always does a fixed 200ms pulse per frame received).

## Decision: Shoot cooldown

Decided: Add a separate toggle button/control for "cooldown" that the user can turn on or off, defaulting to **on**. When cooldown is on, the Shoot button disables itself for ~300ms after each click (200ms firmware pulse duration + margin) before re-enabling. When cooldown is off, Shoot remains immediately clickable again with no artificial delay.

Why: User wanted the cooldown behavior itself to be a user-adjustable toggle rather than a fixed always-on or always-off behavior, to allow experimenting with rapid-fire clicking if desired, while defaulting to the safer button-mash-prevention behavior.

Alternatives rejected: A fixed non-toggleable 300ms cooldown (originally recommended) — user wanted it adjustable instead.

## Decision: Gating (when aim/shoot controls are enabled)

Decided: Aim and shoot controls follow the exact same enablement gate as the existing lights and movement controls: enabled only when `connection.status === "connected" && connection.protocol === "tcp100"`, disabled in every other state (disconnected, connecting, error, or connected over the http80 fallback). See `mapLightControlUiState` / `mapMovementControlUiState` in `app/src/connectionUiState.ts` for the existing pattern to follow.

Why: Directly reuses the established gating rule already applied to every other command in this app — shoot/aim commands only work over an active tcp100 session, identical to lights/movement.

Alternatives rejected: None — directly reused existing convention, no live discussion needed since it's an established precedent.

## Decision: Protocol constant naming

Decided: New named constants in `app/src/commandFrame.ts`, following the existing `DEVICE_LED`/`DEVICE_MOTOR` naming pattern: `DEVICE_SERVO = 0x02` (aim) and `DEVICE_SHOOT = 0x08` (shoot).

Why: Matches existing naming convention in that file exactly.

Alternatives rejected: None discussed.

## Decision: IPC channel/handler naming

Decided: New IPC channels following the existing `car:set-lights` / `car:set-movement` naming pattern in `app/src/ipcChannels.ts`, e.g. `car:set-aim-angle` (carries the absolute target angle number) and `car:shoot` (no arguments — fires once). Corresponding handler functions in `app/src/carIpcHandlers.ts` following the existing `handleSetLights`/`handleSetMovement` shape (e.g. `handleSetAimAngle`, `handleShoot`), and corresponding `CarConnection` methods (e.g. `setAimAngle(angle: number)`, `shoot()`) mirroring the existing `setLedState`/`setMovement` shape in `app/src/carConnection.ts`.

Why: Directly follows the file's established naming and architectural conventions; no live discussion needed, low-stakes mechanical naming decision.

Alternatives rejected: None discussed — exact names are implementation detail, not user-decided; the spec/tickets phase may adjust exact naming as long as the pattern is followed.

## Decision: Testing convention

Decided: Follow the exact testing split already established in this app: pure functions (the frame-builder additions in `commandFrame.ts`, and any new UI-state-mapping functions in `connectionUiState.ts`) get unit tests; new IPC handlers get tested via the existing `FakeCarConnection`/`CarConnectionLike` fake pattern (see `app/src/carIpcHandlers.ts` and its test file); DOM-level interaction logic (press-and-hold timers, active-direction-style state tracking for aim, cooldown toggle wiring) is manually verified against the real physical hardware during implementation, not unit tested — matching the precedent set by the movement plan's ADR-001 (`.gh-workflows/plans/done/20260815_065830-car-movement-light-controls/grill/ADR-001.md`), which states this DOM wiring is "manually verified against hardware, per established convention."

Why: Directly reuses established project convention; this is genuinely new, previously-unverified-on-hardware protocol behavior (device 0x02/0x08 have never been live-tested, unlike lights/movement which are already confirmed working on the real car), so live verification during implementation is required, not optional, before this can be considered done.

Alternatives rejected: None discussed.

## Decision: Scope boundary — camera excluded

Decided: This plan covers shoot and aim (up/down) only. The QD005/QD002 camera function is explicitly out of scope — the physical camera module is confirmed not connected on this unit (per `docs/qd001-hardware-access/index.md`'s "QD005 Water Ball Launcher" section: "Camera (only on QD001+QD002+QD005 bundles) | UART port | ... Not currently connected on this unit (confirmed by user, 2026-08-15)").

Why: No camera hardware is present to test against; adding camera support would be speculative and unrelated to the two functions the user explicitly asked to connect (shoot, movement/aim).

Alternatives rejected: None — straightforward scope exclusion based on confirmed physical hardware absence.

## Decision: USB connection status — display-only badge, folded into this plan

Decided: Add a small, purely informational USB-connection status badge to the UI (e.g. text like "USB: Connected" / "USB: Not connected"), shown next to the existing Wi-Fi connection status text. This does NOT disable, replace, or interact with the existing Wi-Fi "Connect"/"Disconnect" toggle button in any way, and does NOT enable any car commands to be sent over USB.
- Detection mechanism: the Electron main process periodically checks (poll interval: every 2 seconds) for the presence of a device node matching `/dev/cu.usbserial-*` (same identification pattern already documented in `docs/qd001-hardware-access/index.md`'s "USB-serial connection" section), using a read-only filesystem check (e.g. globbing/listing `/dev`) — it does NOT open the serial port, does NOT run `esptool.py`, and does NOT send any data to the device. This is macOS-specific, consistent with the rest of this repo's tooling.
- Known limitation, accepted: this can false-positive if some other unrelated USB-serial device (not the car) happens to be plugged in, since it only checks for the device-node naming pattern, not the car's specific vendor/product ID. Accepted because the badge is purely informational and does not gate or enable any functionality — the risk is a cosmetic false status, not a functional or safety issue.
- New IPC: a new push channel from main to renderer (main process polls, pushes updates), mirroring the existing `car:status` push pattern already used for Wi-Fi connection state, e.g. `car:usb-status` carrying a boolean or small status object.

Why: The user initially asked whether a USB connection could replace/disable the Wi-Fi Connect button because they assumed commands would work identically over USB. This was corrected during the interview (see requirements' environment notes fact 4: the firmware's Serial/UART is debug-output only, never parses command frames) — actively controlling the car over USB is not currently possible with this firmware, so a full USB-mode replacement for the Connect button was ruled out as technically infeasible without new firmware work. The user still wanted USB-plugged-in awareness though, so it was scoped down to a non-functional, informational badge only.

Alternatives rejected: (1) USB connection replacing/disabling the Wi-Fi Connect button with equivalent command support — ruled out, technically infeasible with current firmware (see requirements' environment notes fact 4). (2) Deferring this entirely to a separate plan — user chose to fold in the display-only version now instead.
