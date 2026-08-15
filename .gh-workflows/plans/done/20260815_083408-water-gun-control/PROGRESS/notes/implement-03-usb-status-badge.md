# Implement notes: 03-usb-status-badge

## What was built

A new, independent, informational USB-serial connection status badge, per ADR-002
(`.gh-workflows/plans/20260815_083408-water-gun-control/grill/ADR-002.md`). It has no
command channel and does not interact with the existing Wi-Fi/TCP connection code path.

- `app/src/usbStatus.ts` (new):
  - `isUsbSerialDevicePresent(deviceDirectory = "/dev")`: read-only check for any
    `cu.usbserial-*` entry via `readdirSync`. Returns `false` immediately on any
    non-`"darwin"` platform, and `false` (not a throw) if the directory can't be read.
    `deviceDirectory` is parameterized specifically so tests can point it at a real temp
    directory instead of mocking `node:fs` — production callers always use the default.
  - `startUsbStatusPolling(checkDevicePresent, onStatusChange, intervalMs = 2000)`:
    polls `checkDevicePresent` (an injected function — the seam for testing), calling
    `onStatusChange` only when the detected value differs from the last known one. Fires
    an immediate check at call time (not after the first interval delay), then every
    `intervalMs`. Returns a stop function (`clearInterval`). Structurally mirrors
    `forwardConnectionStatus` in `carIpcHandlers.ts` (dependency + callback in, unsubscribe
    function out) but poll-based rather than event-based, since USB plug/unplug has no
    OS-level event source without native modules.
  - `app/src/usbStatus.test.ts` (new, 9 tests): `isUsbSerialDevicePresent` tested against
    real temp directories (present/absent device file, missing directory, non-darwin
    platform override) — no `node:fs` mocking. `startUsbStatusPolling` tested with a fake
    `checkDevicePresent` function and Node's built-in `test.mock.timers` API (`t.mock.timers`)
    to advance the 2s interval deterministically without real waits — covers initial push,
    no-push-when-unchanged, push-on-change, and stop() halting further polls.

- `app/src/ipcChannels.ts`: added `CAR_USB_STATUS_CHANNEL = "car:usb-status"`.

- `app/src/main.ts`: wires `startUsbStatusPolling(isUsbSerialDevicePresent, ...)` in
  `createWindow()`, pushing to `webContents.send(CAR_USB_STATUS_CHANNEL, connected)`.
  Unsubscribes alongside `stopForwardingStatus` on `window.on("closed", ...)`. Uses its
  own `carConnection`-independent lifecycle — no shared state with the Wi-Fi status path.

- `app/src/preload.ts`: added `CAR_USB_STATUS_CHANNEL` (inlined constant, per this file's
  existing "no local imports" constraint) and `CarApi.onUsbStatus(callback): () => void`,
  following the exact same `ipcRenderer.on`/`removeListener` shape as `onStatus`.

- `app/src/renderer.ts`: added `onUsbStatus` to the locally-redeclared `CarApi` interface;
  added `renderUsbStatus(connected: boolean)` (writes `#usb-status-text`'s text/class
  directly from the pushed boolean — no local mirrored variable, since the badge has "no
  local polling or state of its own" per the ticket); wired
  `window.carAPI.onUsbStatus((connected) => renderUsbStatus(connected))` at the bottom,
  deliberately kept separate from the `onStatus`/`render(state)` cycle — per CONTEXT.md's
  gotcha, USB status is independent of `ConnectionState` and must not be reset by Wi-Fi
  connect/disconnect/error transitions.

- `app/public/index.html`: added `<span id="usb-status-text" class="usb-status-disconnected">
  USB: Not connected</span>` immediately after `#status-text`, plus matching
  `.usb-status-connected`/`.usb-status-disconnected` CSS (same color scheme as the existing
  Wi-Fi status classes). Default text/class assumes "not connected" until the first push —
  same "no initial-state query" precedent as the Wi-Fi status badge.

## Test/build status

All automated checks pass: 149/149 tests (140 pre-existing + 9 new in `usbStatus.test.ts`),
`tsc --noEmit` clean, `npm run build` succeeds (both `tsconfig.build.json` and
`tsconfig.renderer.json` targets), confirmed `dist/usbStatus.js` is emitted.

## Acceptance criteria

All automated/code-level criteria checked off in
`.gh-workflows/plans/20260815_083408-water-gun-control/tickets/03-usb-status-badge.md`.
Four manual hardware-verification criteria are **not run** — this sandboxed coding-agent
environment has no physical USB-serial cable or car access:
- Plugging a USB-serial cable updates the badge within ~2s
- Unplugging a USB-serial cable updates the badge within ~2s
- The badge has zero effect on the Wi-Fi Connect/Disconnect button
- The badge has zero effect on any car command (shoot, aim, lights, etc.)

The latter two are verifiable by code inspection (no shared state or IPC-channel overlap
between `usbStatus.ts`/`renderUsbStatus()` and the Wi-Fi/command code paths — see ticket
file notes), but a human should still confirm on the real running app. Same limitation
pattern as tickets 01 and 02.

## Next session

All three original tickets (01, 02, 03) are done. Current phase is `review/round-1`
(spec match + build/test/security gate). Open items to carry into or alongside review:
- ADR-001's unverified aim-direction sign (`AIM_ANGLE_DELTA` in `app/src/renderer.ts`,
  `up: 1, down: -1`) — one-line flip if backwards, pending hardware test.
- All manual hardware-verification criteria across tickets 01, 02, and 03 — a human should
  batch these into one physical hardware session (Wi-Fi car + USB-serial cable).
