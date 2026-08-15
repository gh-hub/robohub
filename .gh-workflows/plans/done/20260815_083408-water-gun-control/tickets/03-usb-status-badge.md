# 03 — USB status badge end-to-end

**What to build:** an informational badge UI element showing USB-serial connection status (plugged/unplugged), displayed next to the existing Wi-Fi status indicator. Updates within ~2 seconds of cable plug/unplug.

**Blocked by:** None — can start immediately

**Status:** ready

- [x] Main-process polling subsystem checks for `/dev/cu.usbserial-*` device nodes — `isUsbSerialDevicePresent()` in `app/src/usbStatus.ts`
- [x] Polling runs every 2 seconds — `USB_STATUS_POLL_INTERVAL_MS = 2000`, `startUsbStatusPolling()`'s default `intervalMs`
- [x] Polling is read-only — `isUsbSerialDevicePresent()` only calls `readdirSync`, never opens/reads/writes the device node
- [x] Polling is macOS-only — `isUsbSerialDevicePresent()` returns `false` immediately when `process.platform !== "darwin"`
- [x] Polling only pushes status to IPC on change (not on every poll cycle) — `startUsbStatusPolling()` compares against `lastKnownConnected` and only calls `onStatusChange` when it differs
- [x] `car:usb-status` push IPC channel implemented in main process — `CAR_USB_STATUS_CHANNEL` in `ipcChannels.ts`, wired in `main.ts`'s `createWindow()`
- [x] IPC forwarding/subscription plumbing unit tested (mirroring existing `forwardConnectionStatus` pattern) — `app/src/usbStatus.test.ts`, `startUsbStatusPolling` tests (initial push, no-push-on-unchanged, push-on-change, stop() halts polling), using Node's built-in `mock.timers` to avoid real 2s waits
- [x] Main-process filesystem check is stubbed/faked in unit tests (not mocking OS calls) — poller tests pass a fake `checkDevicePresent` function rather than mocking `node:fs`; `isUsbSerialDevicePresent()` itself is tested against a real temp directory (`deviceDirectory` parameter), not by mocking OS calls either
- [x] Preload exposes `onUsbStatus`-style subscription listener to renderer — `CarApi.onUsbStatus` in `preload.ts`
- [x] Badge UI element added next to existing Wi-Fi status text — `#usb-status-text` span in `app/public/index.html`, placed immediately after `#status-text`
- [x] Badge updates reactively via renderer-side listener — `window.carAPI.onUsbStatus()` call at the bottom of `renderer.ts` calls `renderUsbStatus()`
- [x] Badge has no local polling or state of its own (data pushed from main) — `renderUsbStatus(connected)` takes the pushed value directly as its only input; no local variable mirrors it, unlike `lightsOn`/`aimAngle`
- [ ] Manual test: plugging USB-serial cable updates badge within ~2 seconds — **not run**: no physical USB-serial hardware access in this sandboxed coding-agent environment (same limitation as tickets 01/02's hardware tests)
- [ ] Manual test: unplugging USB-serial cable updates badge within ~2 seconds — **not run**, same reason
- [ ] Manual test: USB status badge has zero effect on Wi-Fi Connect/Disconnect button — **not run** on real hardware, but verifiable by code inspection: `usbStatus.ts`/`renderUsbStatus()` never touch `carConnection`, `currentState`, or any Wi-Fi-path DOM element; a human should still confirm on the real app
- [ ] Manual test: USB status badge has zero effect on any car command (shoot, aim, lights, etc.) — **not run** on real hardware, same code-inspection caveat as above (no shared state, no IPC channel overlap, `car:usb-status` is a distinct channel from all command channels)
