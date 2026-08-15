# Spec: water-gun-control

## Problem Statement

The ACEBOTT car control app already lets the user connect to the car over Wi-Fi and drive it (lights, 6-direction movement). The user has since attached the QD005 water gun accessory to the car, which adds a shoot trigger and an aim servo, but the app has no way to fire it or aim it — those two physical controls are currently unreachable from the UI. Separately, the user has no at-a-glance way to tell whether the car is also plugged in over USB, independent of its Wi-Fi connection state.

## Solution

Add three new, independent controls to the existing single-window UI, gated by the same connection rules already governing lights and movement:

1. A **Shoot** button that fires the blaster with one click, with a user-toggleable cooldown (on by default) that briefly disables the button after each shot to discourage button-mashing.
2. **Aim Up/Down** buttons that walk the aim servo through its angle range while held, at a speed the user picks from a Fast/Slow dropdown, clamped to the servo's safe range and disabled at each end of that range.
3. A small **USB status badge** next to the existing Wi-Fi status text that reports, purely for information, whether a USB-serial device is currently plugged in. It never gates or replaces anything Wi-Fi-related.

Shoot and Aim are new device commands on the existing TCP:100 binary command-frame protocol; the USB badge is a completely separate, informational-only subsystem with no relationship to the command protocol at all.

## User Stories

1. As a user with an active tcp100 connection, I want to click a Shoot button, so that the QD005 fires a single shot without me needing to hold anything down.
2. As a user, I want the Shoot button to briefly disable itself after firing (when the cooldown toggle is on), so that I don't accidentally double-fire by mashing the button.
3. As a user, I want to be able to turn the shoot cooldown off, so that I can rapid-fire repeatedly if I choose to.
4. As a user with an active tcp100 connection, I want to press and hold an Aim Up button, so that the water gun barrel walks upward continuously while I hold it, similar to how the movement D-pad already behaves.
5. As a user, I want to press and hold an Aim Down button, so that the barrel walks downward continuously while I hold it.
6. As a user, I want to pick "Fast" or "Slow" from a dropdown, so that I can control how quickly the barrel moves per held-button step.
7. As a user, I want the Aim Up button to become disabled once the barrel reaches its maximum angle, and the Aim Down button to become disabled at the minimum angle, so that I get clear feedback that I've hit the end of the range instead of the app silently doing nothing (or worse, over-driving the servo).
8. As a user, I want the Shoot and Aim controls to only be usable when I'm actually connected to the car over Wi-Fi (tcp100), so that I never get an unresponsive button or a confusing failure when disconnected, connecting, in an error state, or on the http80 fallback.
9. As a user, I want my aim position to reset to a known starting point whenever I freshly connect, disconnect, or hit a connection error, so that the app's idea of the barrel's angle never carries over a stale assumption from a previous session.
10. As a user, I want a small badge showing whether the car is currently plugged in via USB, so that I have a quick physical-connection sanity check independent of the Wi-Fi status.
11. As a user, I want the USB badge to update on its own as I plug and unplug the cable, so that I don't have to do anything to keep it current.
12. As a user, I want the USB badge to have zero effect on the Wi-Fi Connect/Disconnect button or on any car command, so that plugging/unplugging USB never surprises me by changing how the car responds to Wi-Fi controls.

## Implementation Decisions

**Modules to build or modify** (all within the existing `app/` Electron app; no new top-level modules — this plan extends the same seams the lights/movement plans already established):

- The binary command-frame layer gains two new named device-code constants, mirroring the existing LED/motor constants, for the aim servo and the shoot trigger.
- The car-connection layer (the class that owns the TCP socket and exposes one convenience method per command) gains two new methods: one that sends an absolute aim-angle command, and one that sends a single shoot command. Both are thin wrappers over the same generic frame-send path the existing LED/movement methods already use, inheriting its gating/rejection behavior automatically (see below).
- The IPC channel layer gains two new channel names and two new main-process handler functions, following the existing "one channel + one handler per renderer-invokable action" pattern. The aim handler is responsible for validating the incoming angle is within the servo's supported range before it ever reaches the connection layer — the boundary where untrusted renderer input is checked, per the same rationale already applied to the existing movement-direction validation.
- The preload bridge gains matching entries on the narrow `window.carAPI` surface the renderer is restricted to (per the existing no-Node-in-renderer boundary), exposing the two new invokable actions plus a new one-way status subscription for USB updates.
- The renderer-side UI-state-mapping layer gains two new pure mapping functions — one for the Shoot control, one for the Aim control — following the existing pattern where connection-state-to-UI-state logic is a plain, DOM-free function so it stays unit-testable and the DOM-wiring code that calls it stays thin.
- The renderer script gains: press-and-hold event wiring for the two Aim buttons (mirroring the existing movement D-pad's pointerdown/pointerup/pointerleave/pointercancel/window-blur wiring, but driving a throttled repeat rather than a single send-per-event); a click handler and cooldown-toggle wiring for Shoot; a small amount of new app-tracked state (the current aim angle, the current cooldown-toggle setting, the current speed-dropdown selection); and a new listener for USB status pushes that updates the badge text.
- The main process gains a new, small polling subsystem: a timer that periodically checks for the presence of the car's USB-serial device node and pushes a status update to the renderer only on change. This has no relationship to the `CarConnection` class or the TCP:100 command path — it is a standalone, read-only filesystem check.
- The static HTML shell gains the new Shoot/Aim/USB markup (buttons, dropdown, toggle, badge text element), following the existing convention of disabled-by-default elements that the renderer's render pass enables/disables based on connection state.

**Interface changes**

- Two new renderer-invokable actions are added to the command surface: setting an absolute aim angle, and firing a single shoot pulse. Both follow the established "resolves once the action is initiated, rejects synchronously if the connection can't currently accept a command" contract already used by the lights/movement actions — there is no separate "wait for completion" signal for either, matching the protocol's fire-and-forget, no-readback nature.
- One new one-way push is added, alongside the existing connection-status push: a USB-plugged-in status update, sent from the main process to the renderer whenever the polled state changes (not on every poll tick).

**Technical clarifications**

- Aim is app-tracked, absolute-angle state, not a delta/relative command: the renderer keeps a local angle value (starting at the firmware's own boot default), clamps every increment/decrement to the servo's supported range before sending, and sends the resulting absolute angle on every repeat tick while a button is held. This is necessary because the protocol has no readback channel — the app's local value is the only "truth" available, and it must never be allowed to drift outside the range the firmware safely supports.
- The Aim repeat cadence is fixed at the interval that matches the firmware's own per-command processing time, regardless of which speed option is selected — only the step size differs between the two dropdown options, not the interval. This is what keeps at most one aim command in flight at a time, avoiding the command backlog risk called out in ADR-001.
- The Shoot cooldown is purely a renderer-side UI affordance (a timed disable of the button), not a protocol-level throttle or a main-process rate limit — nothing prevents rapid sends at the connection layer itself; the cooldown only shapes what the UI lets the user click.
- The direction sign for Aim Up/Down (which one increases vs. decreases the tracked angle) is a starting assumption pending live hardware verification, per ADR-001 and decisions.md — see "Further Notes."
- The USB badge's detection state is intentionally decoupled from `ConnectionState` / the tcp100 gating rule entirely: it is not part of the `connected && tcp100` gate that governs Shoot/Aim/Lights/Movement, has its own independent state variable in the renderer, and its own independent push channel. It must not be threaded through the existing connection-state UI mapping functions, which are reserved for Wi-Fi/command-gating concerns.

**Architectural decisions** (see ADR-001 and ADR-002 in `grill/` for full rationale)

- ADR-001: Shoot and Aim reuse the existing binary command-frame format and the existing `CMD_RUN` action code, adding only two new device codes. Aim uses press-and-hold with a throttled, fixed-cadence repeat (not click-to-step); Shoot uses single-click with a toggleable cooldown (not press-and-hold, since the firmware's pulse duration is fixed and click-independent).
- ADR-002: USB status is informational-only. It is not, and must never become, an alternate command channel — the firmware's USB-serial link carries debug output only and has no command-frame parser. The badge's detection method is a non-invasive, read-only device-node presence check with an accepted false-positive risk (it cannot distinguish the car from any other USB-serial device), scoped to macOS only.
- Both new device commands (Aim, Shoot) use the exact same connection-gating rule already established for Lights and Movement (`connected && tcp100`) — no new gating logic is introduced, only the same predicate reapplied to two more control groups.

**Schema changes**

- None beyond the wire-level device-code additions described above (no persistent storage or data schema exists in this app; everything is either in-memory renderer state or live socket state).

**API contracts**

- `setAimAngle`-style action: takes an absolute target angle; resolves once the frame is written; rejects (without writing) if the connection isn't currently `connected`+`tcp100`, exactly like the existing lights/movement actions; the main-process handler additionally rejects (before reaching the connection layer at all) if the angle is outside the servo's supported range, mirroring the existing runtime allowlist check already applied to movement directions.
- `shoot`-style action: takes no arguments; resolves once the frame is written; same connection-state rejection contract as above. The value byte sent is a fixed, ignored-by-firmware placeholder, matching ADR-001.
- USB status push: no renderer-initiated request exists (there is no "get current USB status" pull) — same one-way, push-only shape as the existing connection-status push. The renderer's assumed default before the first push arrives should be treated as "unknown/not connected" rather than asserting a false positive, consistent with how the existing connection status assumes "disconnected" until the first push.

**Specific interactions**

- Aim: pointerdown on Up or Down immediately sends one step in that direction and starts the repeat timer; each repeat tick recomputes the clamped angle and sends it; pointerup/pointerleave/pointercancel on the held button stops the repeat (no "stop" command is sent to the firmware — unlike movement, there is nothing to explicitly halt, since the firmware isn't running an indefinite motion, only interpolating to the last angle it was told). A window-blur safety net (mirroring the movement D-pad's) stops any in-progress repeat the same way.
- Aim bounds: the Up button's disabled state and the Down button's disabled state are each independently derived from the current tracked angle versus the servo's min/max, recalculated on every render pass alongside the existing connection-gating check — a button is disabled if either the connection gate says so, or the angle is already at that button's bound.
- Aim reset: the tracked angle resets to the firmware's boot-default angle on the same three status transitions the existing `lightsOn` boolean already resets on (fresh connect, disconnect, error) — deliberately excluding the transient "connecting" state, for the same reason `lightsOn` excludes it.
- Shoot: click sends exactly one command; if the cooldown toggle is on, the button is disabled immediately after the click and re-enabled after a fixed short delay (independent of whether the click actually succeeded or was rejected by a race with a connection-state change); if the toggle is off, no such disable happens and the button remains clickable on the very next render pass.
- USB badge: purely reactive to pushes; the renderer holds no polling logic of its own, no timers, and makes no IPC calls to request or influence USB state — it only listens.

## Testing Decisions

Per grill/decisions.md's "Testing convention" decision, this plan follows the exact same test-seam split already established by the lights and movement plans, with the same rationale: pure logic is unit-tested at its narrowest seam, IPC/handler wiring is tested against a fake, wire-level byte-exactness is tested against a real local mock TCP server, and DOM/press-and-hold/timer wiring is manually verified against the physical car rather than unit tested.

**What makes a good test for this feature**

- Prefer the highest, most decoupled seam available for each piece of new logic rather than testing through the DOM: a pure frame-builder call, a pure UI-state-mapping function call, or a fake/mock-backed handler call, in that order of preference over anything requiring a real window or Electron runtime.
- Test the exact wire bytes for the two new device commands (aim, shoot) the same way the existing LED/motor frame tests already do — asserting the literal byte sequence a mock TCP server receives, not just "some bytes were sent."
- Test the aim-angle validation boundary (accepts 1 and 180 as valid edges, rejects both below 1 and above 180) at the IPC-handler seam, the same way the existing movement-direction allowlist is tested (valid values pass through, invalid/malformed values are rejected before ever reaching the connection layer).
- Test the new UI-state-mapping functions as pure input/output pairs across every relevant connection state (disconnected, connecting, connected+tcp100, connected+http80, error) plus, for Aim specifically, both angle-bound edge cases (at minimum, at maximum, and in between) — following exactly the table-driven pattern the existing lights/movement UI-state tests already use.
- Do not attempt to unit-test the press-and-hold timer behavior, the throttled repeat cadence, the cooldown countdown, or the USB polling's actual filesystem behavior — these are exactly the class of DOM/timer/OS-interaction logic this project has already decided not to unit test, per the movement plan's precedent. They are manually verified against real hardware during implementation instead, and that manual verification is a hard completion gate for this plan (not optional), because — unlike lights and movement — the aim/shoot protocol bytes have never been exercised against the real car before.

**Which modules will be tested**

- Frame-builder additions (new device-code constants exercised through the existing generic frame builder): unit tested.
- The two new `CarConnection` convenience methods: unit tested against a local mock TCP server for exact byte output, plus the same "rejects without writing when not connected+tcp100" cases the existing methods already cover.
- The two new IPC handler functions: unit tested against the existing fake-connection pattern, including the angle-range validation boundary and the "rejects when the connection layer rejects" propagation case.
- The two new UI-state-mapping functions: unit tested as pure functions across the full connection-state matrix (and angle-bound matrix for Aim).
- USB status polling and its IPC push wiring: the forwarding/subscription plumbing (the equivalent of the existing `forwardConnectionStatus` pattern) is unit-testable the same way the connection-status forwarding already is, using a fake or stub in place of the real filesystem check. The actual filesystem-glob detection logic itself is thin enough, and OS-dependent enough, that it's exercised through manual verification (plug/unplug the real cable and watch the badge) rather than mocked filesystem unit tests.
- Renderer DOM wiring for all three new controls (press-and-hold timers, active-hold-direction tracking for Aim, cooldown toggle wiring for Shoot, badge update listener): manually verified against real hardware, not unit tested, per the established convention.

**Prior art in the codebase for similar tests**

- `app/src/commandFrame.test.ts` — exact-byte frame assertions per device/value combination; the pattern to extend for the two new device codes.
- `app/src/carConnection.test.ts` — the mock-TCP-server byte-capture pattern (`captureServerSocket()` + asserting on the server's received `"data"` event) and the "rejects without writing" cases for `setLedState`/`setMovement`; the pattern to extend for the two new convenience methods.
- `app/src/carIpcHandlers.test.ts` — the `FakeCarConnection` fake and the runtime-allowlist rejection tests for `handleSetMovement`; the pattern to extend for the two new handlers, including their own validation boundary tests.
- `app/src/connectionUiState.test.ts` — the table-driven pure-function tests across the full connection-state matrix; the pattern to extend for the two new UI-state mappers.
- The prior movement plan's ADR-001 (`.gh-workflows/plans/done/20260815_065830-car-movement-light-controls/grill/ADR-001.md`) — the explicit precedent that press-and-hold DOM wiring is manually verified against hardware, not unit tested, which this plan continues rather than reopens.

## Out of Scope

- The QD005/QD002 camera function — no camera hardware is connected on this unit; not addressed by this plan at all.
- USB as a command/control channel of any kind — the firmware has no command-frame parser on its Serial/UART path; this remains true after this plan, and the USB badge introduced here explicitly does not attempt to work around that.
- Any USB detection support for Windows or Linux — the badge's detection mechanism is macOS-only (`/dev/cu.usbserial-*`), matching this project's existing macOS-only tooling conventions; other platforms are unaddressed.
- Vendor/product-ID-based USB device identification — the badge accepts the false-positive risk of any USB-serial device (not just the car) triggering "connected," rather than adding more invasive device-descriptor queries.
- Any protocol-level rate limiting or server-side (main-process) enforcement of the shoot cooldown — the cooldown is a renderer UI affordance only, not a safety interlock enforced anywhere else in the stack.
- Any change to the existing Wi-Fi Connect/Disconnect button, lights control, or movement control beyond reusing their already-established gating rule — none of the three existing control groups are modified by this plan.
- A "center"/"reset aim to 90" button or any other aim convenience control beyond Up/Down and the speed dropdown — not requested, not part of this plan.

## Further Notes

- **Open question — Aim direction sign**: ADR-001 and decisions.md both explicitly flag that whether "Up" should increase or decrease the tracked angle (to produce the physically-correct barrel movement) is unverified against the real hardware and depends on how the servo horn happens to be mounted on this specific unit. The spec proceeds with "Up increases, Down decreases" as the implementation default, but this must be confirmed (and flipped if wrong — a one-line change) during live hardware testing in the implement phase before the feature can be considered done.
- **Risk — first-ever live test of this protocol path**: Unlike lights and movement, the aim/shoot device codes (0x02, 0x08) have been reverse-engineered from firmware source but never exercised against the actual physical car. All static analysis in ADR-001 is high-confidence but not a substitute for the live verification gate called out in the Testing Decisions section above.
- **Accepted risk — USB false positives**: carried over from ADR-002 as a permanent, accepted characteristic of the badge, not something this plan attempts to resolve.
- **Ambiguity resolved by inference, not re-litigated here**: the exact IPC channel/handler/method names are left as implementation detail per decisions.md ("the spec/tickets phase may adjust exact naming as long as the pattern is followed") — this spec intentionally describes the two new actions and one new push by role/behavior rather than committing to final identifier names, consistent with that decision.
