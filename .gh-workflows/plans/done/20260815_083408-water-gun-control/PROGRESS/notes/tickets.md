# Tickets phase: End-of-session summary

## What was written

Three approved tickets for the water-gun-control project, transcribed from the user-approved breakdown:

1. **01-shoot-control.md** — Shoot control end-to-end
   - Delivers: `DEVICE_SHOOT` constant, `CarConnection.shoot()` method with byte-exact mock-TCP-server tests, `car:shoot` IPC channel + handler, preload exposure, Shoot button UI with toggleable cooldown control gated by connected && tcp100, `mapShootControlUiState` pure function unit tested across connection-state matrix.
   - Acceptance criteria: 16 concrete, checkable items covering constants, methods, tests, IPC plumbing, preload, UI wiring, pure functions, and manual hardware verification.

2. **02-aim-control.md** — Aim control end-to-end
   - Delivers: `DEVICE_SERVO` constant, `CarConnection.setAimAngle(angle)` method with byte-exact mock-TCP-server tests across representative angles and range validation at trust boundary, `car:set-aim-angle` IPC channel + handler, preload exposure, Up/Down + Fast/Slow UI with press-and-hold event handlers (pointerdown/up/leave/cancel + window-blur safety), throttled 400ms fixed-cadence repeat, renderer-side `aimAngle` state (default 90°, clamped 1–180°, reset on connect/disconnect/error), `mapAimControlUiState` pure function covering connection-state gating and angle-bound edge cases.
   - Acceptance criteria: 24 concrete items covering constants, methods, tests, IPC plumbing, preload, UI wiring, state management, pure functions, and manual servo + bounds testing.

3. **03-usb-status-badge.md** — USB status badge end-to-end
   - Delivers: main-process polling subsystem checking `/dev/cu.usbserial-*` every 2 seconds (read-only, macOS-only, push-on-change only), `car:usb-status` push IPC channel with forwarding/subscription plumbing unit tested like `forwardConnectionStatus`, preload exposure of `onUsbStatus`-style subscription, badge UI element next to Wi-Fi status, updated reactively via renderer listener (no local polling/state).
   - Acceptance criteria: 14 concrete items covering polling, IPC channel, forwarding plumbing, preload, UI wiring, and manual plug/unplug + isolation testing.

## Blocking & sequencing

All three tickets are independent — no blocking edges. Suggested implement order (by interaction complexity):
1. Shoot control (01) — simplest, single-click
2. Aim control (02) — more complex, press-and-hold + state tracking
3. USB status badge (03) — orthogonal polling + UI-only

## What's next

→ Start implementing ticket 01-shoot-control. Follow the 16 acceptance criteria in order: constants, methods + tests, IPC plumbing, preload, UI wiring, pure function + tests, manual verification.
