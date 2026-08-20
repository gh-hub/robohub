# Decisions: car-log-viewer

## Decision: App-only scope, no firmware changes
Decided: This plan only touches `app/src/`. No `.ino`/firmware source is added or modified.
Why: This repo has no maintained/buildable firmware source tree — only reference copies extracted from the ACECode install. Firmware changes belong in the user's separate ACECode Block-editor workflow.
Alternatives rejected: Including a firmware change (e.g. wiring the pasted `Serial.println` heartbeat into `sendToClient()`) as part of this plan.

## Decision: Cross-platform support (Windows + macOS)
Decided: The USB detection/monitoring must work correctly on both Windows and macOS.
Why: This dev machine is Windows, but the existing code/docs were written against macOS only — both need to keep working.
Alternatives rejected: Windows-only scope (rejected since it would regress macOS users of the existing badge).

## Decision: USB port auto-detection by VID/PID
Decided: The app auto-detects the car's serial port using `serialport`'s `SerialPort.list()`, matching Vendor ID `0x1A86` and Product ID `0x7523` (the confirmed CH340 identity). No manual port selection UI.
Why: Matches the confirmed hardware identity already documented in this repo; avoids asking the user to pick/hardcode a port number/device node that drifts per cable/port.
Alternatives rejected: A manual dropdown port picker showing all available serial ports.

## Decision: USB presence badge stays passive; USB log streaming is a separate explicit action
Decided: The existing "USB: Connected/Not connected" badge is fixed to use `SerialPort.list()` (enumeration only, never opens the port) and remains fully automatic/passive. Actually opening the serial port to stream log data into the USB Log panel requires a new, separate, explicit "Connect" button (mirroring the existing Wi-Fi Connect/Disconnect button pattern).
Why: Opening a serial port is exclusive to one process at a time; an always-on automatic monitor would risk blocking Arduino IDE or `esptool.py` from accessing the same port while the app is running.
Alternatives rejected: Automatically opening the port and starting log streaming the instant a matching device is detected.

## Decision: Wi-Fi log panel piggybacks on the existing Wi-Fi Connect button
Decided: No new button for Wi-Fi logging. Once a `tcp100` session is connected (via the existing Connect button), any inbound socket data is automatically streamed into the Wi-Fi Log panel. An `http80` session produces no Wi-Fi log traffic, since that protocol has no persistent connection to read from.
Why: The TCP:100 socket is already open and owned by the app for the whole session once connected — there is no port-contention risk like there is with USB, so no separate gating is needed.
Alternatives rejected: A separate explicit toggle/button for Wi-Fi log streaming, independent of the main Connect button.

## Decision: Log panel UI — same window, capped in-memory buffers, no persistence
Decided: Both log panels ("Wi-Fi Log", "USB Log") are added to the existing single app window, below the current controls, as side-by-side scrollable monospace panels. Each auto-scrolls to the newest line, has its own "Clear" button, is capped at 500 lines (oldest dropped once exceeded), and prefixes each line with an app-generated receipt timestamp (not a firmware timestamp, since the firmware doesn't provide one). Logs are in-memory only (no disk persistence) and are NOT auto-cleared on connect/disconnect/reconnect — only by the Clear button or app restart.
Why: Matches the app's existing single-window architecture; a capped in-memory buffer avoids unbounded memory growth without the complexity of file persistence, which isn't needed for a debugging tool.
Alternatives rejected: A separate log window; persisting logs to disk; auto-clearing on disconnect.

## Decision: New dependency — `serialport` npm package
Decided: Add `serialport` as a new runtime dependency for real cross-platform serial port enumeration and I/O, including whatever native-rebuild-for-Electron step (e.g. `electron-rebuild`) is needed to make its native bindings work under Electron's Node ABI.
Why: Node's built-in modules have no serial port support; `serialport` is the standard library for this in Node/Electron and its `list()`/read API covers the cross-platform auto-detect and streaming requirements decided above.
Alternatives rejected: Hand-rolling platform-specific serial I/O (rejected as impractical); exploring lighter-weight alternative libraries (user declined to explore further, accepted `serialport` directly).

## Decision: Fixed 115200 baud rate
Decided: The USB serial connection always uses 115200 baud; not user-configurable.
Why: Confirmed as the correct rate both by the pasted sketch's own `Serial.begin(115200)` and by this repo's `docs/qd001-hardware-access/connecting.md`, which documents that `460800` fails on this adapter/cable combination.
Alternatives rejected: A user-configurable baud rate setting (unnecessary — only one rate is known to work with this hardware).
