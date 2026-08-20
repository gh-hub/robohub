# Ticket breakdown — session end 2026-08-15 16:33:08

## Summary

Transcribed the approved ticket breakdown into 4 implementation tickets for the car-log-viewer plan:

1. **01-serialport-dep-and-usb-badge-fix** — Add `serialport` npm dependency and rewrite `usbStatus.ts` to use `SerialPort.list()` with VID/PID matching (0x1A86/0x7523) for CH340 cross-platform detection. Fixes USB presence badge on Windows and macOS.

2. **02-shared-log-panel-infra** — Create pure, shared buffering module (byte-to-line splitting, newline handling, ISO timestamp prefixing) and pure renderer module (append with 500-line cap, auto-scroll, Clear function). Add two empty log-panel DOM elements (Wi-Fi Log, USB Log) with Clear buttons, no live data yet.

3. **03-wifi-log-panel** — Wire `CarConnection` tcp100 socket data to the shared buffering and renderer modules. IPC push channel forwards lines to renderer. Preload exposes subscription API. Connect via existing Wi-Fi button, see timestamped bytes stream into panel. Disconnect or session end stops new lines.

4. **04-usb-log-panel** — USB-serial module opens CH340 port at 115200 baud, reads, closes. IPC channels for connect/disconnect actions and line push. Preload exposes `usbConnect()`, `usbDisconnect()`, and log subscription. Renderer adds Connect/Disconnect buttons. Full cycle: click Connect → open port → stream timestamped data → click Disconnect → close port. App exit also closes cleanly.

## Dependencies
- Ticket 01 is unblocked (can start immediately)
- Ticket 02 is unblocked (can start immediately)  
- Ticket 03 blocked by Ticket 02
- Ticket 04 blocked by Tickets 01 and 02

## Next
Start implementation of Ticket 01 (serialport dependency and USB badge fix).
