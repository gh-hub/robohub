# Context: car-log-viewer

## What we're building
Add two live log-monitor panels (Wi-Fi Log and USB Log) to the existing single-window Electron car-control app, plus fix the broken USB "connected" badge on non-macOS platforms.

## Key decisions
- App-only scope, no firmware changes (app/src/ only)
- Cross-platform support for Windows and macOS
- USB port auto-detection by VID/PID (CH340: 0x1A86/0x7523)
- USB presence badge stays passive; USB log streaming requires explicit user action (new Connect button)
- Wi-Fi log piggybacks on existing Wi-Fi Connect button (TCP:100 session only)
- Log panels: same window, capped in-memory buffers (500 lines), no persistence, auto-scroll, own Clear buttons
- New dependency: `serialport` npm package for cross-platform enumeration and I/O
- Fixed 115200 baud rate (not user-configurable)
- [ADR-001: USB handling supersedes the prior non-invasive enumeration-only constraint](grill/ADR-001.md)

## Tickets

1. ~~[01 — Add `serialport` dependency; fix USB presence badge cross-platform](tickets/01-serialport-dep-and-usb-badge-fix.md)~~ — done
2. ~~[02 — Shared log-panel infrastructure (buffer, timestamp, render, clear)](tickets/02-shared-log-panel-infra.md)~~ — done
3. ~~[03 — Wi-Fi Log panel — live streaming end-to-end](tickets/03-wifi-log-panel.md)~~ — done
4. ~~[04 — USB Log panel — connect/stream/disconnect end-to-end](tickets/04-usb-log-panel.md)~~ — done

## Completed tickets
1. [01 — Add `serialport` dependency; fix USB presence badge cross-platform](tickets/01-serialport-dep-and-usb-badge-fix.md) — `serialport` added as first runtime dependency, `usbStatus.ts` rewritten to use `SerialPort.list()` with cross-platform CH340 VID/PID matching, macOS-only code path removed. Badge display itself unverified against real hardware (none available). See [notes](PROGRESS/notes/implement-01-serialport-dep-and-usb-badge-fix.md) for details.
2. [02 — Shared log-panel infrastructure (buffer, timestamp, render, clear)](tickets/02-shared-log-panel-infra.md) — new `app/src/logLineBuffer.ts` (pure byte-to-line buffering + `[HH:MM:SS.mmm]` timestamping, main-process side) and `app/src/logPanel.ts` (pure `appendLogLines`/`clearLogLines` + thin DOM-wiring `renderLogPanel`, renderer-side ESM). Two new empty panels (`#wifi-log-panel`/`#usb-log-panel`) with working Clear buttons added to `index.html`/`renderer.ts`. No IPC or live data wired yet — that's tickets 03/04. See [notes](PROGRESS/notes/implement-02-shared-log-panel-infra.md), including a noted coding-rule conflict (Playwright UI-verification rule vs. spec.md's own manual-testing decision for DOM wiring).
3. [03 — Wi-Fi Log panel — live streaming end-to-end](tickets/03-wifi-log-panel.md) — `CarConnection` now emits a `"log-line"` event (tcp100 only) via `LogLineBuffer`; new `CAR_WIFI_LOG_LINE_CHANNEL` IPC channel, `forwardWifiLogLines()` in `carIpcHandlers.ts`, `onWifiLogLine()` in preload, and live wiring in `renderer.ts` (`appendLogLines` + `renderWifiLog()`) complete the end-to-end path. Spanned two sessions due to a rate-limit interruption. See [notes](PROGRESS/notes/implement-03-wifi-log-panel.md), including a template for ticket 04's equivalent USB-log wiring and a reminder that `isCh340Port`/`SerialPortIdentity` still need extracting out of `usbStatus.ts` into a shared module.
4. [04 — USB Log panel — connect/stream/disconnect end-to-end](tickets/04-usb-log-panel.md) — new `app/src/usbSerialConnection.ts` (`UsbSerialConnection`, the USB-serial counterpart to `CarConnection`; injectable `openSerialPort`/`findPortPath`, reuses `LogLineBuffer`, fixed 115200 baud) and `app/src/usbLogIpcHandlers.ts` (mirrors `carIpcHandlers.ts`'s connect/disconnect/log-forwarding shape). `isCh340Port`/`SerialPortIdentity` extracted out of `usbStatus.ts` into a new shared `app/src/ch340Port.ts` (also adds `findCh340PortPath`), per spec.md — `usbStatus.ts` re-exports both for backward compatibility. Three new IPC channels, preload's `usbLogConnect`/`usbLogDisconnect`/`onUsbLogLine`, and a new `#usb-log-toggle-button` in `renderer.ts`/`index.html` complete the end-to-end path. Originally shipped with `UsbSerialConnection.connect()` *rejecting* on failure instead of resolving (no status-push channel existed for USB Log yet) — this was flagged in review round 1 and fixed in [review-round-1-fix-02](PROGRESS/notes/implement-review-round-1-fix-02-spec-usb-connect-contract-and-error-surfacing.md), which also added the `onUsbLogStatus` push channel and closed the stale-button-label UX gap as a side effect. See [notes](PROGRESS/notes/implement-04-usb-log-panel.md) for ticket 04's original reasoning (superseded by the fix above).

## Current state
Phase: review
Current ticket: none — all round-2 fixes done, review round 3 next

Review round 1 FAILED — see [findings](review/round-1/findings.md). All 3 fix tickets are now done: fix 1 (security: unbounded `LogLineBuffer` memory growth), fix 2 (spec: USB Log connect() promise contract + operator-facing error surfacing), and fix 3 (spec: removed unrequested `"dev"` npm script) — see their notes files. Review round 2 FAILED — see [findings](review/round-2/findings.md). All 3 fix tickets are now done: fix 1 (security: batch log-line emission per chunk instead of one IPC send per line), fix 2 (spec: close the USB serial port on a non-closing `"error"` event — `attachSessionListeners()`'s `"error"` listener now closes the port best-effort and clears `this.port` synchronously, with a `this.port !== port` stale-listener guard on both `"close"`/`"error"` to prevent a delayed close from a since-errored port clobbering a subsequently opened one), and fix 3 (spec: documented the `LogLineBuffer` `MAX_PENDING_LENGTH` size-cap decision in spec.md's Implementation Decisions section, docs-only, no code change) — see their notes files. Review round 3 PASS. Plan complete.

## Load this session
- [Spec](spec.md)
- [review/round-2/findings.md](review/round-2/findings.md) — full context for round-2 fix ticket 03, specifically the "(b) Minor scope creep" item (spec.md doesn't document `LogLineBuffer`'s `MAX_PENDING_LENGTH` discard behavior)
- [ADR-001](grill/ADR-001.md) — the USB-handling decision that supersedes the prior non-invasive enumeration-only constraint

## Gotchas
- `npm run build`'s new `rebuild-native` step (`electron-rebuild -f -w serialport`) cannot run in this sandbox — no Visual Studio Build Tools / native C++ toolchain installed here. `@serialport/bindings-cpp` ships N-API prebuilt binaries that `npm install` already resolves correctly (proven working via `npm test`), so this is likely a non-blocking gap, but real verification needs a dev machine with the toolchain (or just trusting the N-API prebuild) present.
- No CH340 USB hardware available in this environment — any USB-hardware-dependent acceptance criteria across all four tickets need manual verification on a real machine with the car plugged in.
- This sandbox also has no interactive display session and no Playwright/Electron driver infra — GUI/visual verification (not just hardware-dependent behavior) needs a real dev machine too. A brief headless `electron .` launch can still catch load-time JS errors (no uncaught exceptions from `main.js`/`preload.js`/`renderer.js`), which is the closest to automated GUI verification currently available.
- (Resolved by review-round-1-fix-02) `UsbSerialConnection.connect()` now always resolves once initiated, matching `CarConnection.connect()` exactly, via a new `onUsbLogStatus` IPC push channel (`CAR_USB_LOG_STATUS_CHANNEL`) forwarding its existing `"state-change"` event. This also fixed the stale-button-label-after-unplug gap noted in ticket 04's original notes — both were the same underlying "no USB Log status-push channel" gap, closed by the same fix.
