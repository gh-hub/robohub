# Spec: car-lights-control

## Problem Statement

The user's ACEBOTT QD001 smart car has two physical LED light modules, but the existing Electron control app only connects to the car and shows connection status — it has no way to send any command to the car yet. The user wants to turn the car's lights on and off from the app.

## Solution

Add two toggle buttons, "Left Light" and "Right Light", below the existing Connect/Disconnect control. Because the car's WiFi/TCP:100 protocol only exposes one shared on/off command for both LEDs (no independent left/right addressing exists over the wire, and no firmware changes are in scope), both buttons are a mirrored toggle: clicking either one sends the identical LED command and both buttons always show the same state. The app tracks this state itself (optimistic/app-tracked) since the protocol has no state-readback channel. State resets to "off" on every fresh connect or reconnect. Both buttons are disabled whenever the car isn't connected, or is connected over the http80 fallback (which has no LED support at all) — enabled only for an active tcp100 session.

Sending the command reuses and extends the existing architecture: the main process owns all socket I/O, so `CarConnection` (or an adjacent main-process module) gains the ability to build and send a binary command frame over the already-open TCP socket; the renderer triggers it through a new IPC channel, exactly like the existing connect/disconnect flow.

## User Stories

1. As a user, I want to see "Left Light" and "Right Light" toggle buttons below the Connect/Disconnect control, so that I have a clear, discoverable way to control the car's lights.
2. As a user, I want clicking either light button to turn the car's LEDs on or off, so that I can control the physical lights from the app.
3. As a user, I want both light buttons to always show the same state, so that the UI doesn't lie about hardware I know only has one shared LED command.
4. As a user, I want the light buttons disabled when the car isn't connected, so that I can't trigger a command with nowhere to go.
5. As a user, I want the light buttons disabled when connected over the http80 fallback, so that I'm not offered a control the firmware can't act on.
6. As a user, I want the light buttons enabled as soon as I have an active tcp100 connection, so that I can use them immediately once connected.
7. As a user, I want both toggles to show "off" immediately after a fresh connect or reconnect, so that the app's assumed state starts from a known, consistent baseline rather than carrying over stale state from a previous session.
8. As a user, I want the toggle's displayed state to update immediately when I click it (optimistic), so that the UI feels responsive even though the protocol can't confirm the car actually received the command.
9. As a developer extending this app later (movement, buzzer, servo), I want the binary command frame format and the frame-sending capability to be documented and reusable, so that future device commands don't require rediscovering the wire protocol.

## Implementation Decisions

- **Reusable binary frame builder.** A pure function builds a command frame from `device`, `action`, and `value` bytes, following the frame layout documented in ADR-001 (`0xFF 0x55 <length> <payload>`, with action/device/value at the documented payload offsets, reserved bytes zero-filled). This function is generic across future device commands (movement, buzzer, servo), not LED-specific, per ADR-001's stated intent to make this the canonical reference for all TCP:100 work.
- **Frame-sending capability on the main-process car-connection layer.** `CarConnection` (or an adjacent main-process module operating on it) gains the ability to send an already-built frame over the currently-open TCP socket. It only sends when the session's negotiated protocol is tcp100; it rejects (without writing to the socket) when there's no active connection or the active connection is http80. A convenience for the LED command specifically (device = LED, action = CMD_RUN, value = on/off) sits on top of the generic frame-sender.
- **New IPC channel for the light command**, following the existing request-style pattern used by the connect/disconnect channels (defined in `ipcChannels.ts`, with no local imports across the preload boundary — channel names stay inlined in `preload.ts` and hand-kept in sync, per that file's existing constraint). The channel carries the desired on/off value; both "Left Light" and "Right Light" invoke the exact same channel/value pair, since they're mirrored.
- **`CarConnectionLike` interface (used by `carIpcHandlers.ts`) is extended** with the new light-command method, so the existing fake-based IPC handler tests continue to work without a real socket.
- **`preload.ts`'s exposed `window.carAPI` surface is extended** with a light-control call, following the same "resolves once initiated, rejects if the action doesn't make sense right now" contract as `connect`/`disconnect`.
- **Renderer-side mirrored toggle state.** The renderer holds one local boolean ("lights on/off"), not two independent ones — reinforcing that both buttons are views onto the same underlying state. It resets to "off" on every transition into a fresh `connected` state (mirroring the existing reset-on-connect precedent already used for connection status) and whenever the connection is lost or in error. Clicking either button flips this local state immediately (optimistic) and then fires the IPC call.
- **Button enable/disable gating** extends the existing pattern that already gates the Connect/Disconnect button on `ConnectionState.status`: light buttons are enabled only when `status === "connected"` **and** `protocol === "tcp100"`; disabled in every other case (`disconnected`, `connecting`, `error`, or `connected` with `protocol === "http80"`).
- **UI placement**: new row/section below the existing Connect/Disconnect button and status text, in `app/public/index.html`, following that file's existing inline styling conventions (disabled-state opacity/cursor treatment already established for `#toggle-button`).
- **No schema or persisted-state changes.** Nothing is written to disk; light state lives only in renderer memory for the lifetime of the current connection.

## Testing Decisions

This feature follows the same layered test-seam pattern already established in the codebase — pure functions and narrow interfaces are the seams, not DOM or Electron integration:

- **Frame builder**: pure function, tested with `node:test` input/output pairs (given device/action/value bytes, assert the exact resulting byte sequence), the same style as `connectionUiState.test.ts`. This is the seam ADR-001 specifically calls out as needing frame-construction unit tests.
- **Main-process command-sending capability**: tested against a mock TCP server the same way `carConnection.test.ts` already tests `connect()`/`disconnect()` — assert the exact bytes the mock server receives when a light command is sent while connected via tcp100, and assert the call rejects (with nothing written to the socket) when disconnected or on an http80 session.
- **IPC handler layer**: extend the existing `FakeCarConnection`-based tests in `carIpcHandlers.test.ts` — assert the new handler calls the right `CarConnectionLike` method with the right value, and rejects when the underlying call rejects. Same seam already used for `handleConnect`/`handleDisconnect`.
- **Renderer UI-state mapping**: a pure function (alongside or extending `mapConnectionStatusToUiState` in `connectionUiState.ts`) that takes connection state plus the local light-on boolean and returns the buttons' disabled/label state — tested the same input/output-pair way as the existing `connectionUiState.test.ts` suite (disabled when disconnected/connecting/error/http80, enabled + correctly labeled when connected+tcp100).
- **Not tested at the DOM/Electron level**: consistent with the existing convention, `renderer.ts`'s DOM wiring and `preload.ts`'s `contextBridge` exposure aren't unit tested directly — only the pure logic underneath them is. Manual verification against the real car (confirming the reverse-engineered frame format from ADR-001 actually toggles the physical LEDs) happens during implementation, the same way the existing connect/disconnect IPC test suite calls out manual devtools-console verification as its integration check.

## Out of Scope

- Firmware changes or reflashing of any kind.
- Independent left/right LED control via separate hardware addresses (would require firmware changes; not supported by the current protocol).
- Hardware state readback or querying (the protocol has no query/response channel).
- Preserving light state across app restarts or reconnects (state always resets to "off" on a new connection).
- Any light control over the http80 fallback protocol (zero LED support in that firmware).
- Any other device command (movement, buzzer, servo) — only the LED command is being wired end-to-end in this plan, even though the frame-builder itself is written generically per ADR-001.
- UI polish, animations, or multi-screen flows beyond the two toggle buttons.
- Packaging changes — the app continues to run in development mode via `npm start`.

## Further Notes

- **Binary frame format is unconfirmed against real hardware.** ADR-001's frame layout was reverse-engineered from firmware source code only; the implementation phase (ticket 1 in the draft breakdown) is the first live test against the user's actual car. If the running firmware differs from the example source (the flash dump shows extra camera-related strings not present in the plain example), the reserved-byte assumptions may need adjustment — flagged as a risk, not a blocker.
- **Left/right GPIO mapping is unconfirmed and left unresolved.** Firmware source comments and the official tutorial video disagree on which physical LED is "left" vs. "right." This is explicitly low-stakes since the protocol drives both identically regardless of label, so the spec does not attempt to resolve it — the button labels are cosmetic only.
- **Single mirrored IPC channel/value, not two independent channels.** The grill decisions establish that both buttons send the identical command, but didn't explicitly settle whether that's implemented as one parameterized channel (carrying an on/off value) versus two no-argument channels (mirroring the connect/disconnect channel shape). This spec makes the call for one parameterized channel, since the value it carries (on/off) is intrinsic to what's being commanded and splitting it into two channels would just duplicate wiring for no benefit. Flagged here as a judgment call, not an explicit grill decision, in case it should be revisited.
