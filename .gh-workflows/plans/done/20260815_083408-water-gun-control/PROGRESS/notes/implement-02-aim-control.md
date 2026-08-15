# Implement notes: 02-aim-control

## What was built

End-to-end Aim (servo) control — press-and-hold Up/Down with a Fast/Slow step-size
dropdown — following the exact seam pattern established by ticket 01 (shoot-control)
and the movement/lights plans before it:

- `app/src/commandFrame.ts`: `DEVICE_SERVO = 0x02` constant, per ADR-001.
- `app/src/commandFrame.test.ts`: byte-exact frame tests for the servo device code
  across 7 representative angles (1, 5, 45, 90, 135, 179, 180 — both bounds included).
- `app/src/carConnection.ts`: `CarConnection.setAimAngle(angle)` — thin wrapper over
  `sendCommandFrame()`, same gating/rejection contract as `setLedState()`/
  `setMovement()`/`shoot()` (inherited, not duplicated). Range validation is
  deliberately NOT done here — it lives at the IPC trust boundary, matching where
  `setMovement()`'s direction-allowlist check lives relative to this same class.
- `app/src/carConnection.test.ts`: byte-exact mock-TCP-server tests for
  `setAimAngle()` across the same 7 angles, plus "rejects when disconnected" and
  "rejects on http80" cases.
- `app/src/ipcChannels.ts`: `CAR_SET_AIM_ANGLE_CHANNEL = "car:set-aim-angle"`.
- `app/src/carIpcHandlers.ts`: `setAimAngle(angle)` added to `CarConnectionLike`;
  `handleSetAimAngle` added to `CarIpcHandlers`/`createCarIpcHandlers()`, validating
  `Number.isInteger(angle) && angle >= 1 && angle <= 180` at the trust boundary
  (rejects non-integers, out-of-range, NaN, Infinity, and non-number values) before
  calling through — mirrors `handleSetMovement`'s allowlist-check shape.
- `app/src/carIpcHandlers.test.ts`: `FakeCarConnection` extended with
  `setAimAngle()`/`setAimAngleCalls`/`onSetAimAngle` (matching the
  `setMovement`/`shoot` call-count-and-array pattern per ticket 01's gotcha note);
  tests for valid angles (call-through), invalid angles (rejection without reaching
  the connection), and rejection propagation.
- `app/src/connectionUiState.ts`: `mapAimControlUiState(connection, angle)` — pure
  function returning `{ upDisabled, downDisabled }`. Same `connected && tcp100` gate
  as `mapShootControlUiState`, ORed with the angle-bound edge cases (`angle >= 180`
  disables Up, `angle <= 1` disables Down) per ADR-001's "Bounds" decision. Speed
  selection and the repeat-timer are deliberately NOT part of this pure mapping.
- `app/src/connectionUiState.test.ts`: table-driven tests across the connection-state
  matrix (both buttons disabled in every non-tcp100 state) plus explicit bound-edge
  cases (Up disabled/Down enabled at 180, Down disabled/Up enabled at 1, both
  disabled+at-bound when also disconnected).
- `app/src/preload.ts`: `setAimAngle: (angle: number) => Promise<void>` added to
  `CarApi`, wired to `ipcRenderer.invoke(CAR_SET_AIM_ANGLE_CHANNEL, angle)`. Inlined
  channel constant, matching this file's existing no-local-imports convention.
- `app/src/main.ts`: `ipcMain.handle(CAR_SET_AIM_ANGLE_CHANNEL, ...)` wired to
  `carIpcHandlers.handleSetAimAngle()`.
- `app/src/renderer.ts`: full press-and-hold wiring —
  - `aimAngle` (default 90, firmware boot default), `aimSpeed` ("fast"/"slow",
    default "fast"), `aimHoldDirection`, `aimRepeatTimer` module-level state.
  - `AIM_STEP_DEGREES = { fast: 10, slow: 5 }`, `AIM_REPEAT_INTERVAL_MS = 400`,
    `MIN_AIM_ANGLE = 1`, `MAX_AIM_ANGLE = 180`.
  - `AIM_ANGLE_DELTA = { up: 1, down: -1 }` — the one place to flip if the live
    hardware test shows the direction sign is backwards (per ADR-001's flagged open
    question); called out inline in a comment above it.
  - `stepAim(direction)`: computes one step, clamps, updates `aimAngle`, re-renders,
    fires `window.carAPI.setAimAngle()`, and returns whether the angle actually
    changed (used to auto-stop the repeat timer once a bound is reached mid-hold,
    rather than continuing to send no-op repeats).
  - `handleAimPointerDown`/`handleAimRelease`/`stopActiveAim`: interrupt semantics
    mirroring the movement D-pad's pointerdown-overwrites / release-must-match
    pattern, but using a real `setInterval` (400ms) for the throttled repeat instead
    of movement's continuous-send-until-stop model — a materially different shape
    per ticket 01's gotcha note, not force-fit to either precedent.
  - First step fires immediately on pointerdown (real-time feedback, matching
    ADR-001's stated interaction-feel rationale), then repeats every 400ms while held.
  - `window.blur` now stops both active movement AND active aim (previously only
    movement).
  - `onStatus` handler: `aimAngle` resets to 90 at the same three points `lightsOn`
    resets (connected/disconnected/error, NOT "connecting"); `stopActiveAim()` is
    called whenever the session leaves `connected && tcp100` (mirrors
    `clearActiveMovement()` — no "stop" frame is sent, since a held repeat timer
    firing into a now-rejecting `setAimAngle()` would just be pointless IPC calls).
  - `renderAim(state)`: sets Up/Down `disabled` from `mapAimControlUiState()` and
    updates an `#aim-angle-text` readout (`"Aim: {angle}°"`) — not an explicit
    acceptance criterion, but a near-zero-cost addition that directly supports the
    still-open manual direction-verification criterion (the tester needs to see what
    angle was just sent to correlate with the physical servo motion observed).
- `app/public/index.html`: `#aim-controls` div with `#aim-up-button`/
  `#aim-down-button` (disabled by default), `#aim-speed-select` (`<select>` with
  `fast`/`slow` options, Fast selected by default), and `#aim-angle-text`.

## Test results

- `npm test` (full suite): 140/140 passing (was 97 before this ticket; +43 new
  tests across commandFrame/carConnection/carIpcHandlers/connectionUiState).
- `npx tsc --noEmit` and `npx tsc --project tsconfig.renderer.json --noEmit`: both
  clean.
- `npm run build`: succeeds.

## Ambiguities resolved by inference (not blocking)

- ADR-001 doesn't specify whether the first aim step on pointerdown fires
  immediately or only after the first 400ms tick. Chose immediate-first-step +
  400ms-interval-after, matching the movement D-pad's immediate-send-on-pointerdown
  precedent and ADR-001's own stated rationale ("Press-and-hold gives users
  real-time visual feedback... releasing = stopping").
- Auto-stopping the repeat timer once a bound is reached mid-hold (rather than
  continuing to send identical no-op angle commands every 400ms until release) is
  not an explicit acceptance criterion, but a direct, low-complexity consequence of
  the clamping requirement — avoids pointless IPC/socket traffic while a button is
  held at the bound.
- The `#aim-angle-text` readout DOM id/format are new implementation-detail names,
  not specified anywhere — added because it's the only way a human tester can
  correlate "what angle was just sent" with "which way the servo physically moved"
  during the still-open manual direction-verification step, without adding any new
  application state (it just displays the existing `aimAngle` variable).

## Blocker: manual hardware verification not performed

Three acceptance criteria are unchecked in `tickets/02-aim-control.md`:

- Manual test: holding Up/Down in running app walks the real servo.
- Manual test: servo direction verified live and flipped if backwards (ADR-001's
  explicitly flagged open question).
- Manual test: button disabling at 1° and 180° bounds is verified live.

Per ADR-001 and spec.md, these are explicit, non-optional completion gates — device
0x02 has never been live-tested against the physical QD005 unit before this plan.
This coding-agent environment has no physical access to the car or its Wi-Fi
network, so these three criteria cannot be completed here — same limitation as
ticket 01's shoot-control manual tests. Everything upstream of the physical hardware
(byte-exact wire format via mock TCP server, IPC handler wiring via fake connection,
UI-state gating/bounds logic, press-and-hold DOM wiring, build, typecheck, full test
suite) is done and passing.

**A human with physical access to the car must**, before this plan is considered
fully done:
1. Run `npm start` in `app/`, connect to the car over tcp100.
2. Hold the Up button and observe whether the physical servo/barrel tilts up or
   down. If it moves the wrong way, flip the sign in `AIM_ANGLE_DELTA` in
   `app/src/renderer.ts` (`up: 1, down: -1` → `up: -1, down: 1`) — a one-line fix,
   per ADR-001's explicit note that this is expected to be trivial if wrong.
3. Confirm holding Up/Down walks the angle smoothly at both Fast (10°/step) and Slow
   (5°/step) speeds via the dropdown, with no visible command backlog/stutter.
4. Confirm the Up button disables when the angle readout reaches 180°, and the Down
   button disables at 1°.
5. This is a good opportunity to also (re-)run ticket 01's still-pending manual
   Shoot verification in the same hardware session (see
   `PROGRESS/notes/implement-01-shoot-control.md`).

This does not block starting ticket 03 (usb-status-badge) — that ticket has its own
scope (informational USB serial polling) with no dependency on the aim/shoot
hardware verification.

## Gotchas / notes for next session (03-usb-status-badge)

- Per CONTEXT.md's ADR-002 summary, ticket 03 is informational/display-only (no
  commands over USB) and macOS-only (`/dev/cu.usbserial-*` polling every 2s) — it
  does NOT touch `commandFrame.ts`, `carConnection.ts`, or the IPC command channels
  at all. It's a materially different shape from tickets 01/02 (no TCP protocol
  involvement, no press-and-hold, likely a new small polling module rather than
  extending `CarConnectionLike`/`FakeCarConnection`).
- The three-reset-points precedent (`lightsOn`/`aimAngle` reset on
  connected/disconnected/error, not "connecting") is specific to app-tracked command
  state with no protocol readback — it likely does NOT apply to ticket 03, since a
  USB-serial-present/absent badge is its own independent, polled signal unrelated to
  the TCP connection lifecycle. Don't force-fit that pattern onto it.
- No manual-hardware-verification blocker is expected to carry over to ticket 03 in
  the same way — polling for a `/dev/cu.usbserial-*` path is observable without
  needing the QD005 attachment live-tested, though actually confirming the badge
  reflects a real USB connection still needs a live macOS environment (this
  sandboxed environment's actual /dev tree should be checked before assuming that
  part is testable here either).
