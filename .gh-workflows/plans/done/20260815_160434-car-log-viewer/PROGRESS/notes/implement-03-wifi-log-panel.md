# Implement notes: 03 — Wi-Fi Log panel — live streaming end-to-end

This ticket spanned two sessions: the first was interrupted mid-work by a
rate limit, after `carConnection.ts`'s tcp100 `"log-line"` emission
(data listener + `LogLineBuffer` wiring) was already implemented and typechecked/tested-clean.
This second session picked up from that clean state and finished the rest
of the end-to-end wiring — nothing from the first session was reverted or
redone, only extended.

## What was built this session

- `app/src/ipcChannels.ts`: new `CAR_WIFI_LOG_LINE_CHANNEL = "car:wifi-log-line"` constant.
- `app/src/carIpcHandlers.ts`:
  - `CarConnectionLike` gained `on`/`off` overloads for the `"log-line"` event (alongside the existing `"state-change"` overloads).
  - New `forwardWifiLogLines(connection, sendLine)` — subscribes `sendLine` to every `"log-line"` event, returns an unsubscribe function. Exact same shape as the existing `forwardConnectionStatus()`.
- `app/src/main.ts`: wired `forwardWifiLogLines(carConnection, (line) => window.webContents.send(CAR_WIFI_LOG_LINE_CHANNEL, line))` in `createWindow()`, with the same unsubscribe-on-`closed` discipline as the existing status/USB-status forwarding.
- `app/src/preload.ts`: added `CAR_WIFI_LOG_LINE_CHANNEL` (hand-duplicated per the file's "no local imports" constraint) and `onWifiLogLine(callback)` on `CarApi`, following the exact `onStatus`/`onUsbStatus` pattern (subscribe via `ipcRenderer.on`, return an unsubscribe that calls `removeListener`).
- `app/src/renderer.ts`: added `onWifiLogLine` to the locally-redeclared `CarApi` interface, imported `appendLogLines` from `logPanel.ts` (previously unused/unimported on purpose, per ticket 02's notes — now used), and wired `window.carAPI.onWifiLogLine((line) => { wifiLogLines = appendLogLines(wifiLogLines, [line]); renderWifiLog(); })` at the bottom of the file, next to the existing `onUsbStatus` wiring.

## Tests added

- `app/src/carConnection.test.ts` (filled the gap the first session's notes flagged — no dedicated test existed yet for `"log-line"` emission):
  - tcp100 session emits `"log-line"` for each newline-delimited line received on the socket, correctly timestamped (`[HH:MM:SS.mmm]` prefix).
  - A trailing partial line (no newline) is not emitted — matches `LogLineBuffer`'s discard-partial-line contract.
  - An http80 session never emits `"log-line"` at all (no persistent socket to listen on) — confirms the "disconnecting/session-ending stops appending" acceptance criterion for the one path that has no socket to begin with.
- `app/src/carIpcHandlers.test.ts`: `forwardWifiLogLines` forwards every `"log-line"` event, and its returned unsubscribe stops further forwarding — mirrors the existing `forwardConnectionStatus` tests exactly.

All 182 tests pass (`npm test`, Node's built-in `node --test` runner — not vitest). `npm run typecheck` is clean. Also ran `npx tsc --project tsconfig.build.json && npx tsc --project tsconfig.renderer.json` (the build without the native `rebuild-native` step, which still can't run in this sandbox — no native toolchain) followed by a brief headless `npx electron .` launch: no uncaught JS exceptions from `main.js`/`preload.js`/`renderer.js`, only expected sandbox-environment noise (GPU/disk-cache errors from the headless/no-display environment itself, unrelated to app code).

## What's NOT verified (needs a real dev machine)

- Live end-to-end against the actual car's TCP:100 firmware sending real bytes — no hardware in this sandbox. The mock-TCP-server tests exercise the identical code path (`CarConnection`'s real `net.Socket` handling), so this is a high-confidence gap, not an unknown, per the plan's established precedent for hardware-dependent criteria.
- Visual/DOM verification (auto-scroll behavior, panel rendering) — no display/Playwright/Electron-driver infra in this sandbox. `renderLogPanel()`/the DOM-wiring layer is unchanged from ticket 02 and was already flagged there as manual-only, per spec.md's Testing Decisions (only the pure `appendLogLines`/`clearLogLines` logic is unit-tested; the DOM-wiring function itself is not, by design — see the noted coding-rule conflict with the "verify UI with Playwright" general rule, carried forward unchanged from ticket 02's notes).

## Gotchas for the next session (ticket 04 — USB Log panel)

- Ticket 04 needs a new USB-serial-owning module (per spec.md's "A new module owns opening, reading from, and closing the physical USB serial port" decision) that reuses `LogLineBuffer` the same way `carConnection.ts` now does — `probeTcpAndHold()`'s `LogLineBuffer` wiring (lines ~289-296 of `carConnection.ts`) is a good concrete reference for the "fresh buffer per successful open, feed via a data listener, re-emit as discrete lines" shape to replicate for the serial port.
- `forwardWifiLogLines`/`CAR_WIFI_LOG_LINE_CHANNEL`/`onWifiLogLine` in `carIpcHandlers.ts`/`ipcChannels.ts`/`preload.ts`/`renderer.ts` are direct templates for the USB-log equivalents ticket 04 needs (a `CAR_USB_LOG_LINE_CHANNEL`, `forwardUsbLogLines`, `onUsbLogLine`, wiring `usbLogLines`/`renderUsbLog()` in `renderer.ts` — `usbLogLines`/`renderUsbLog()` already exist from ticket 02, only the live-data wiring is missing, mirroring exactly what this ticket just did for the Wi-Fi side).
- Ticket 04 also needs the new USB Log Connect/Disconnect IPC channels/handlers (separate from the new module's log-line forwarding) — per spec.md, these follow the same "resolves once initiated, rejects synchronously for an invalid current state" contract as the existing Wi-Fi connect/disconnect.
- `isCh340Port`/`SerialPortIdentity` currently live in `app/src/usbStatus.ts` (from ticket 01) but per spec.md need to become a shared helper used by both the presence badge and the new USB Log connect action — ticket 04 likely needs to extract these into their own module rather than importing them out of `usbStatus.ts` directly.
- No CH340 hardware and no native `serialport`/Electron-rebuild toolchain in this sandbox (already noted in `CONTEXT.md`'s Gotchas) — ticket 04's serial-port-owning module should be tested via a fake/injectable interface (per spec.md's Testing Decisions), never against real hardware or the native binding, exactly like this ticket tested `CarConnection` against a real mock TCP server instead of a real car.
