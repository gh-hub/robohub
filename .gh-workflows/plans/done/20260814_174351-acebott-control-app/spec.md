# Spec: acebott-control-app

## Problem Statement

I own an ACEBOTT QD001 smart car (ESP32-based) and currently control it only through the official ACEBOTT phone app, which joins the car's own `ESP32-Car` Wi-Fi hotspot to send commands. I want to start building my own desktop control layer on my Mac instead of being locked into the phone app, but right now there is no code at all for this — not even a way to open a connection and see whether it's alive. Before I can build any car-control features (driving, later the QD002 water gun, a nicer UI), I need a minimal desktop app that proves out the most basic capability: reliably connecting to the car over Wi-Fi/TCP and always showing me the true state of that connection, including when it silently drops.

## Solution

Build a new Electron desktop app, written in TypeScript with no frontend framework, living in a new `app/` subdirectory of this repository. The app presents a single window with one status area and one toggle button:

- Clicking the button while disconnected starts a connection attempt: the button shows "Connecting…" and is disabled.
- The main process (Node.js) probes the car — first attempting a raw TCP connect to port 100 (the binary protocol the official phone app uses), then, if that doesn't succeed, an HTTP GET to port 80 (the alternative example firmware) — since the user's physical car's actual protocol is not confirmed and must be determined live against hardware.
- Whichever probe succeeds puts the app in the "connected" state; the button switches to "Disconnect" and the status area shows "Connected."
- If both probes fail, the app shows an "error" state with a message hinting the user should check they've joined the `ESP32-Car` Wi-Fi network.
- Once connected, the main process listens for the underlying TCP socket's `close`/`error` events (not polling) and automatically flips the UI to "disconnected" (clean close) or "error" (abrupt close) the moment the connection actually goes away — the UI never keeps claiming "Connected" after the car has gone offline.
- Clicking "Disconnect" while connected cleanly closes the socket and returns the UI to "disconnected."

All socket I/O happens in the main process using Node's built-in `net` module (per ADR-002); the renderer never touches raw sockets or Node APIs directly — it talks to the main process only through a preload-exposed IPC API. The car's connection details (IP `192.168.4.1`, SSID `ESP32-Car`, candidate ports 100/80) are hardcoded constants; there is no settings UI. The user is responsible for manually joining the `ESP32-Car` Wi-Fi network via macOS's Wi-Fi menu before clicking Connect — the app does not attempt to join or switch networks itself. The app runs in development mode via `npm start`; packaging a signed `.app`/`.dmg` is not part of this work.

## User Stories

1. As a user, I want to click a single "Connect" button after joining the car's Wi-Fi network, so that I can establish a control connection to my QD001 car without a complex setup flow.
2. As a user, I want the button to show "Connecting…" and become disabled while a connection attempt is in progress, so that I know my click registered and I don't double-click it.
3. As a user, I want to see a clear "Connected" status once the TCP connection to the car succeeds, so that I have confidence the app is ready to be built on for real control features later.
4. As a user, I want the app to automatically try both known car protocols (binary TCP on port 100, then HTTP on port 80) when I click Connect, so that I don't have to know in advance which firmware my physical car is actually running.
5. As a user, I want to click "Disconnect" while connected, so that I can cleanly end the session and release the connection.
6. As a user, I want the app to automatically detect when my connection drops — car powered off, car out of Wi-Fi range, my Mac left the `ESP32-Car` network — without me needing to notice on my own, so the displayed status never lies about the real connection state.
7. As a user, I want a clear, specific error message when a connection attempt fails or drops abruptly, so I understand what went wrong (e.g., neither port responded, or the socket errored out) and what to check (Wi-Fi network).
8. As a user, I want the error state's button to read "Connect" again (not stuck disabled or stuck showing a dead state), so I can retry immediately after fixing the underlying issue.
9. As a user, I want a clean disconnect (I clicked "Disconnect," or the car closed the socket gracefully) to be visually distinguishable from an abrupt/error disconnect, so I can tell "I stopped it" apart from "something went wrong."
10. As a developer extending this app later, I want the car's IP, SSID, and port(s) stored as named constants in one place, so I can update them easily (new car, changed password) without a settings UI.
11. As a developer, I want the renderer process to have zero direct access to Node.js APIs or raw sockets (per ADR-002), so the app follows Electron's standard security model even though it's a small personal-use tool.
12. As a developer, I want to run the app locally via `npm start` in development mode, so I can iterate quickly without building or signing a packaged macOS app.
13. As a developer, I want the TCP/protocol-probing logic and the status-to-UI mapping logic implemented as plain, framework-free TypeScript modules, so they can be unit- and integration-tested without launching Electron or needing the physical car attached for most test runs.
14. As a developer picking this codebase up in a future plan (car movement, gun control), I want the connection status payload to carry which protocol was detected (TCP:100 vs HTTP:80), so later work can build the right command-sending logic without re-probing from scratch.

## Implementation Decisions

- **New `app/` subdirectory, greenfield.** No `package.json`, TypeScript config, or code layout exists anywhere in the repo yet. This ticket establishes the app skeleton — Electron main process, preload script, renderer, TypeScript build/dev tooling — from scratch, per ADR-002's process split.
- **Main process owns the car connection.** A single, framework-free connection module in the main process wraps Node's `net.Socket`, exposing a small state machine over four `ConnectionStatus` values: `disconnected`, `connecting`, `connected`, `error`. It is the sole owner of socket lifecycle (connect, disconnect, listening for `close`/`error`). This module has no Electron dependency itself, so it can be exercised directly in tests and, later, reused if the app's process structure changes.
- **Protocol probe is sequential, not parallel.** On Connect, the module first attempts a raw TCP connect to port 100 with a short timeout; only if that attempt fails (refused, timed out, or errors) does it attempt an HTTP GET to port 80. The first one that succeeds determines both the "connected" status and which protocol (`tcp100` or `http80`) is recorded for that session. If neither responds within its timeout, the status becomes `error` with a message indicating the car was unreachable on both known ports.
- **No movement/command payloads.** The HTTP:80 probe request must not trigger a car action as a side effect (e.g., avoid `?move=` parameters); the goal is only to confirm the server responds, not to control the car. The exact confirmation request (e.g., `GET /`) is an implementation-time detail to validate against real hardware in ticket 02.
- **Status payload carries protocol + human-readable message.** Rather than a bare enum, the status pushed from main to renderer includes the `ConnectionStatus` value, an optional message string (for error detail or "connected via port 100" style info), and the detected protocol once known. This satisfies "display connection status" today and avoids a breaking payload shape change when a future plan needs to know which protocol to speak.
- **IPC contract.** Two request-style channels (renderer → main) for `connect` and `disconnect`, and one push-style channel (main → renderer) for status updates. The preload script exposes only these three operations via `contextBridge`; `contextIsolation` stays on and `nodeIntegration` stays off in the renderer's `BrowserWindow`, per ADR-002. The `connect`/`disconnect` calls resolve once the action has been *initiated* (or reject if the action doesn't make sense in the current state, e.g. calling `connect` while already `connecting`); the status-push channel is the single source of truth the renderer renders from — it never needs to poll or query current status.
- **Config as constants, not data.** Car IP, SSID, and the two candidate ports live as named constants in a single small config module in the main process (not environment variables, not a settings file, not a UI). This matches the decision that a settings UI is unnecessary at this stage.
- **Single toggle button, driven by state, not two buttons.** The renderer implements one small, pure mapping function from `ConnectionStatus` (plus message/protocol) to the button's label, disabled flag, and the status area's text/visual state (e.g., a status-color class for connected/error/disconnected/connecting). Keeping this mapping pure and separate from DOM-wiring code is what makes it testable without a real window.
- **No auto-reconnect.** Detecting a drop only updates the displayed status (to `disconnected` or `error`); the app does not automatically retry the connection. The user re-initiates with the same Connect button.
- **No persistence across app restarts.** Detected protocol, last-known status, and any connection history are in-memory only for the current app session; nothing is written to disk.
- **Tech stack stays minimal.** No frontend framework (per repo decision) — plain HTML/CSS/TypeScript in the renderer. Standard Electron + TypeScript + a minimal build/dev script (e.g., `tsc` plus `electron .`) is sufficient; no bundler is required for a project this small unless implementation finds a concrete need.

## Testing Decisions

- **No prior art exists in this repository** — this is a from-scratch app with no existing test suite, harness, or conventions to follow. Testing approach is being established fresh by this plan.
- **Test external behavior at module boundaries, not internals.** The two highest-value seams, in priority order:
  1. **Car connection / protocol-probe module boundary (main process).** This is the seam with the most real risk (network I/O, timeouts, two mutually exclusive protocols) and the easiest to test deterministically: stand up local mock TCP and HTTP servers (via Node's own `net.createServer` / `http.createServer`) in place of the real car, and drive the module through connect → connected, connect → both-ports-fail → error, connected → remote close → disconnected, connected → remote error → error, and connect-while-already-connecting rejection. This validates the state machine and probe sequencing without needing the physical car for every run.
  2. **IPC contract boundary.** Because launching a full Electron process for every test run is expensive and brittle, the IPC handler wiring (the functions bound to the `connect`/`disconnect` channels, and the formatting of the status-push payload) should be written as plain functions that take the connection module as a dependency, so they can be invoked directly in tests to verify they call the right connection-module methods and shape the status payload correctly — without spinning up Electron's IPC machinery itself.
- **Secondary seam: renderer status-to-UI mapping.** The pure function mapping `ConnectionStatus` (+ message/protocol) to button label/disabled/status-text is trivial to test as input→output pairs, decoupled from the DOM.
- **Hardware-in-the-loop verification is manual, not automated.** Because the physical car's actual protocol is unconfirmed (per ADR context), the very first real-world check — does port 100 or port 80 actually respond on the real QD001 — must be done manually against the physical hardware during implementation (join `ESP32-Car`, run the app, observe which path succeeds). This is not something CI or an automated suite can verify; it's a one-time implementation-time confirmation that also validates the mock-server tests were modeling the real protocol correctly.
- **Test runner:** given the project's "no framework bloat" ethos and zero existing dependencies, prefer Node's built-in test runner (`node:test` + `node:assert`) for the connection-module and IPC-handler tests, avoiding a new dependency for something this small. This is a low-stakes implementation-time choice, not an architectural one — see Further Notes.

## Out of Scope

- Car movement control (forward/backward/turn/etc.) — deferred to a future `car-movement-control` plan.
- Gun (QD002) control — deferred to a future `gun-control` plan; no local documentation for the gun exists yet.
- UI polish, theming, animations, or multi-screen flows beyond the single connect/status screen — deferred to a future `control-ui-polish` plan.
- Packaging as a signed/notarized macOS `.app` or `.dmg` — dev-mode (`npm start`) only for this plan.
- Automating Wi-Fi network joining/switching from within the app (e.g., shelling out to `networksetup`) — the user joins `ESP32-Car` manually via macOS settings.
- A settings UI for editing the car's IP/SSID/port — these remain hardcoded constants.
- Automatic reconnection after a detected drop.
- Persisting connection status, protocol detection results, or logs across app restarts.
- Supporting more than one car/device connection at a time.
- Bluetooth/BLE support of any kind (ADR-001) — the firmware doesn't support it.

## Further Notes

- **Open question — exact probe timeouts.** The grill output specifies *that* both ports must be probed but not exact timeout values for each attempt. Implementation should pick a reasonable default (e.g., 2–3 seconds per port) and adjust based on what's observed against the real car.
- **Open question — exact HTTP:80 probe request.** Decisions confirm the probe should be a GET to port 80, but not the exact path. Recommend trying `GET /` first since it's least likely to be mistaken for a movement command; if the example HTTP firmware doesn't respond to `/`, this needs adjusting once tested against real hardware or the HTTP firmware's source in `docs/`.
- **Open question — whether detected protocol should be re-probed every Connect, or remembered.** Current decision (Testing/Implementation sections above) is to re-probe every time to keep the state machine simple and stateless across sessions; if probing turns out to be slow or flaky in practice, a future ticket could cache the last-known-good protocol as an optimization. Flagged here rather than decided, since grill output didn't address this directly.
- **Test runner choice (`node:test`) is a suggestion, not a hard requirement.** If it proves awkward to wire up with the TypeScript + Electron toolchain during implementation, swapping to Vitest or Jest is a reasonable, low-risk substitution; it doesn't affect the module boundaries or architecture described above.
- **Risk:** the entire premise that both port-100 and port-80 probing paths are correctly understood rests on reading firmware source in `docs/`, not on a confirmed live test — the first implementation session should treat "which protocol does the real car speak" as the first thing to verify, since it de-risks everything built after it (this is already reflected in the ticket ordering below).
- **Risk:** Electron's `contextBridge`/`contextIsolation` setup has a learning curve if the implementer hasn't used it before; ADR-002 and the Electron security docs should be the reference during ticket 01/03.
