# 04 — Renderer UI: toggle button + status display

**What to build:** A pure `ConnectionStatus → UI state` mapping function, HTML/CSS for a single toggle button ("Connect"/"Disconnect") and status area, wired to the preload API, so the user can click to connect, see live updates, and click to disconnect with automatic drop detection.

**Blocked by:** 03 — IPC bridge + preload contract

**Status:** ready

- [x] Pure `ConnectionStatus → UI state` mapping function implemented and unit tested with input/output pairs
- [x] Single toggle button ("Connect"/"Disconnect") and status display area in the renderer UI
- [x] Renderer wired to preload API for connect/disconnect actions and status updates
- [ ] End-to-end manual verification against real QD001 hardware: connect, see live status, disconnect, observe automatic drop detection — **Deferred — requires user to join ESP32-Car Wi-Fi and run the full app; see PROGRESS/notes/implement-04-renderer-ui-toggle.md**

## Manual verification

This is the one criterion above that could not be completed by the agent — it requires physically joining the car's Wi-Fi hotspot, which an agent session must never attempt. Once you're ready:

1. On your Mac, join the `ESP32-Car` Wi-Fi network via the macOS Wi-Fi menu.
2. In a terminal, `cd app` and run `npm start` (this rebuilds via `tsc` then launches Electron).
3. In the app window, click **Connect**. Watch the button switch to "Connecting…" (disabled), then to either:
   - "Disconnect" with a green "Connected to 192.168.4.1:100 (TCP)" or "...80 (HTTP)" status, or
   - "Connect" again with a red error message if neither port responded (check you're actually on the `ESP32-Car` network).
4. While connected, click **Disconnect**. Confirm the button returns to "Connect" and the status returns to "Disconnected".
5. To observe automatic drop detection: click **Connect** again, then power off the car (or physically move your Mac out of Wi-Fi range) without clicking Disconnect. Confirm the UI updates on its own — to "disconnected" for a clean remote close or "error" for an abrupt one — within a few seconds, without any further clicks. Note: per ticket 02's findings, this live drop detection only works if the car turned out to speak TCP:100 (the HTTP:80 firmware closes its socket after every request and has no persistent session to detect a drop on — see implement-02 notes gotcha 1 and CONTEXT.md gotcha 6).
6. Report back which protocol (TCP:100 or HTTP:80) the physical car actually used, and whether drop detection worked as described — this is also the first live confirmation of ticket 02's protocol-probing logic against real hardware (see ticket 02's own "Manual verification" section, still separately deferred there too).
