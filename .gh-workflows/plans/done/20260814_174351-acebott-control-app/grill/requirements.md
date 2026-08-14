# Requirements: acebott-control-app

## Problem

I own two ACEBOTT robotics kits (a QD001 smart car and a QD002 water gun) and currently control the QD001 car using the official ACEBOTT phone app. The app connects to the car over Wi-Fi by joining the car's own Wi-Fi hotspot. I want to build a custom desktop control app for macOS (using Electron) as an alternative control layer, and eventually extend it to both the car and the gun with a custom UI I design myself.

## Solution

Build an Electron desktop app (using TypeScript, no frontend framework) that can connect to the ACEBOTT QD001 smart car over Wi-Fi/TCP and display the connection status. The app will:

- Show a simple UI with a toggle button that switches between "Connect" and "Disconnect" states
- Display the current connection status (disconnected, connecting, connected, or error)
- Automatically detect when the TCP connection drops (e.g., car powered off, Wi-Fi lost) and update the UI accordingly
- Require the user to manually join the car's Wi-Fi network (`ESP32-Car`) via macOS Wi-Fi settings before connecting

The TCP connection will be managed by the Electron main process (Node.js) using the built-in `net` module; the renderer process (web UI) will interact with it only via IPC messages and a preload script, never by doing raw socket I/O directly.

## Done looks like

- Electron app runs locally via `npm start` (development mode)
- User can click "Connect" after joining the `ESP32-Car` Wi-Fi network
- A successful TCP connection to the car (on whichever port it listens on — 100 or 80, to be determined) shows "Connected" with connection status displayed
- If the connection drops or fails, the UI automatically updates to show the failure state and displays an appropriate error message
- If the user clicks "Disconnect" while connected, the TCP connection cleanly closes and the UI returns to "disconnected" state
- The app code is organized in an `app/` subdirectory with proper TypeScript setup and no framework bloat

## Out of scope

- Car movement control (forward, backward, turn, etc.) — will be a separate future plan (`car-movement-control`)
- Gun control — will be a separate future plan (`gun-control`)
- UI polish, advanced features, or multi-screen flows — will be a separate future plan (`control-ui-polish`)
- Packaging the app as a signed/notarized macOS `.app` or `.dmg` — dev-mode running is sufficient for this ticket
- Automating Wi-Fi network switching from the app — user manually joins the network via macOS settings first

## Environment notes

### Firmware and protocol facts

- The car runs a MicroPython firmware on an ESP32 that operates in Wi-Fi Access Point mode, broadcasting the SSID `ESP32-Car` with password `12345678`
- The official ACEBOTT phone app controls the car via a custom binary packet protocol over raw TCP on port 100. Packet format: header `0xFF 0x55`, length byte, payload with action/device/value bytes (action byte at index 9, device byte at index 10, value byte at index 12)
- An alternative, simpler example firmware exists that serves HTTP on port 80 with `GET /Car?move=f` endpoints for movement control
- These two firmwares (binary TCP:100 and HTTP:80) are mutually exclusive — a car runs only one or the other
- **The car's actual firmware (which of the two examples, or a factory variant) is NOT yet confirmed and must be probed during implementation by attempting TCP connect to both port 100 and HTTP GET to port 80**
- No Bluetooth/BLE support was found in any ACEBOTT firmware example code (QD001 or QD005 kits) — the firmware uses Wi-Fi/TCP exclusively

### Network configuration

- ESP32 access-point default gateway and self-IP is `192.168.4.1` (standard for MicroPython AP mode)
- When a device joins the car's `ESP32-Car` Wi-Fi network, it can reach the car at `192.168.4.1:100` (or `:80` depending on firmware)

### Repository state

- This repository (`robohub`) contains only `README.md` and a `docs/` folder with tutorial/firmware material for QD001 and QD005 kits before this plan starts
- No QD002 (water gun) documentation exists locally — will be fetched from https://acebott.com/tutorial/ in a future plan
- No existing package.json, app code, or code-layout conventions established yet
- The app code will be created in a new `app/` subdirectory

