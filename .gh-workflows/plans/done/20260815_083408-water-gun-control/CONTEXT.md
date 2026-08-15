# Context: water-gun-control

## What we're building
Connect the QD005 water gun attachment (shoot button, press-and-hold aim up/down) to the ACEBOTT car app, plus an informational USB-connected status badge.

## Key decisions
- **ADR-001**: Servo/shoot command protocol (device 0x02 angle 1–180, device 0x08 fixed 200ms pulse), press-and-hold aim with throttled repeat (400ms matching firmware blocking time), user-selectable step size (Fast 10°, Slow 5°), clamped 1–180°, aim direction sign unverified (pending hardware test), single-click shoot with user-toggleable cooldown (default on).
- **ADR-002**: USB status is informational display-only (no commands over USB — firmware serial is debug-output only), polling `/dev/cu.usbserial-*` every 2 seconds, macOS-only, accepts false-positives from other USB-serial devices.

## Current state
Phase: review/round-1 (complete)
Completed phases: grill, spec, tickets, implement/01-shoot-control, implement/02-aim-control, implement/03-usb-status-badge, review/round-1
Completed tickets: 01-shoot-control (all automated criteria done; 2 manual hardware-verification criteria unchecked — no physical car access in this environment, see PROGRESS/notes/implement-01-shoot-control.md), 02-aim-control (all automated criteria done; 3 manual hardware-verification criteria unchecked — no physical car access in this environment, see PROGRESS/notes/implement-02-aim-control.md), 03-usb-status-badge (all automated criteria done; 4 manual hardware-verification criteria unchecked — no physical USB-serial cable/car access in this environment, see PROGRESS/notes/implement-03-usb-status-badge.md)
Current ticket: none — all three original tickets are done and review complete

Plan complete.

## Tickets

1. **01-shoot-control** — Shoot button (single-click + toggleable cooldown) — DONE (automated); manual hardware test pending
2. **02-aim-control** — Servo aiming (press-and-hold Up/Down + Fast/Slow + 1–180° bounds) — DONE (automated); manual hardware test pending
3. **03-usb-status-badge** — USB connection status badge (informational, polled every 2s) — DONE (automated); manual hardware test pending

## Load this session
- .gh-workflows/plans/20260815_083408-water-gun-control/spec.md (spec, for spec-match review)
- .gh-workflows/plans/20260815_083408-water-gun-control/grill/ADR-001.md and ADR-002.md (design decisions to check implementation against)
- .gh-workflows/plans/20260815_083408-water-gun-control/PROGRESS/notes/implement-03-usb-status-badge.md (latest session end-state)
- coding-rules/ (skill defaults) + .gh-workflows/plans/coding-rules/ (project, if present)

## Gotchas

- Manual hardware verification (clicking Shoot on the real car, confirming the 200ms pulse and cooldown toggle) could not be performed in this coding-agent environment — no physical car/Wi-Fi access. This is a hard completion gate per ADR-001 and remains open; a human must run it before the plan is fully done. Ticket 02 (aim) hit the same limitation plus its own open question (aim direction sign, per ADR-001) — consider batching both tickets' manual verification (plus ticket 03's USB badge live check, if applicable) into one hardware session.
- `CarConnectionLike` (in `app/src/carIpcHandlers.ts`) and `FakeCarConnection` (in `app/src/carIpcHandlers.test.ts`) now include `shoot()` and `setAimAngle(angle: number)`, both following the same call-count-and-array-plus-optional-override-impl pattern.
- `DEVICE_SERVO = 0x02` (from ADR-001) is now defined in `commandFrame.ts`, added in ticket 02.
- Ticket 02's aim direction sign is a starting assumption (`AIM_ANGLE_DELTA` in `app/src/renderer.ts`, `up: 1, down: -1`) explicitly flagged as unverified in ADR-001 — if a live hardware test shows it's backwards, flip that one object's two values. This is a manual-verification blocker, not resolved in this session.
- Per ADR-002 (loaded above), ticket 03 is informational/display-only (no commands sent over USB — firmware serial is debug-output only), macOS-only, polling `/dev/cu.usbserial-*` every 2 seconds. It's a materially different shape from tickets 01/02: no TCP command protocol involvement, so it likely does NOT extend `commandFrame.ts`/`carConnection.ts`/`CarConnectionLike`/`FakeCarConnection` at all — probably a new small polling module instead. Don't force-fit the shoot/aim seam pattern onto it.
- The three-reset-points precedent (`lightsOn`/`aimAngle` reset on connected/disconnected/error, not "connecting") is specific to app-tracked TCP-command state with no protocol readback — it likely does NOT apply to ticket 03's USB badge, which is its own independent, polled signal unrelated to the TCP connection lifecycle.
- Ticket 03 confirmed the above prediction: `app/src/usbStatus.ts` (new module) does not touch `commandFrame.ts`/`carConnection.ts`/`CarConnectionLike`/`FakeCarConnection` at all. It exports `isUsbSerialDevicePresent(deviceDirectory = "/dev")` (read-only `readdirSync` check, macOS-only, `deviceDirectory` parameterized so tests use a real temp dir instead of mocking `node:fs`) and `startUsbStatusPolling(checkDevicePresent, onStatusChange, intervalMs = 2000)` (poll-based analog of `forwardConnectionStatus` — takes an injected check function + callback, returns a stop/unsubscribe function, pushes only on change).
- `renderer.ts`'s USB badge wiring (`renderUsbStatus()`, `window.carAPI.onUsbStatus(...)`) is deliberately kept outside the `render(state)`/`onStatus` cycle — it has no local mirrored variable (unlike `lightsOn`/`aimAngle`) and must not be reset or affected by Wi-Fi connect/disconnect/error transitions, confirming the gotcha above.
- Node's built-in `test.mock.timers` API (`t.mock.timers.enable({ apis: ["setInterval"] })` / `t.mock.timers.tick(ms)`) is available (Node v22.21.1 in this environment) and was used in `usbStatus.test.ts` to test the 2-second poll interval deterministically without real waits — a precedent worth reusing for any future timer-based logic instead of real `setTimeout`-based test delays.
- Review should note: ticket 03's manual hardware tests (plug/unplug badge update, zero-effect-on-Wi-Fi, zero-effect-on-commands) were not run for the same reason as tickets 01/02 (no physical hardware in this environment) — batch all three tickets' manual verification into one human hardware session before considering the plan fully done.
