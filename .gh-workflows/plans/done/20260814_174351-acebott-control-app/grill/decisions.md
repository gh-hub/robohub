# Decisions: acebott-control-app

## Decision: No Bluetooth for the car connection

Decided: The app will connect to the car via Wi-Fi/TCP, not Bluetooth/BLE.

Why: The user initially wanted Bluetooth so the Mac would retain internet access while connected to the car. However, inspection of the ACEBOTT firmware source code (both QD001 and QD005 examples) revealed zero BLE/Bluetooth support — any Bluetooth capability would require writing a new GATT server firmware from scratch, far beyond the scope of "step one."

Alternatives rejected: (a) Reflash the car's firmware to Wi-Fi station mode so it joins the user's home network instead of hosting its own hotspot — this would keep the Mac's internet connection and reuse the same TCP protocol, but requires firmware changes the user did not choose; (b) Write new BLE firmware from scratch — rejected as too much work for this ticket.

---

## Decision: Wi-Fi transport — car keeps its own hotspot, no firmware changes

Decided: The Electron app will connect to the car over Wi-Fi by joining the car's `ESP32-Car` network (exactly as the phone app does today). The car's firmware remains unchanged and continues operating in AP mode, broadcasting its own Wi-Fi hotspot.

Why: Simplest option, zero firmware changes required, matches exactly how the official ACEBOTT phone app works today. The tradeoff is that the Mac loses regular internet while connected to the car's hotspot (unless it has a separate connection like Ethernet).

Alternatives rejected: None — this was the user's preferred choice after Bluetooth was ruled out.

---

## Decision: Plan scope is narrow — connect/status only

Decided: This plan (`acebott-control-app`) covers only the Electron connect/status UI end-to-end (grill → spec → tickets → implement → review) as a single ticket. Car movement control, gun control, and UI polish will each become separate `/gh-dev-workflow` plans later.

Why: The user framed "step one" as connecting to the car; further features are explicitly deferred.

Alternatives rejected: None.

---

## Decision: Car protocol must be probed during implementation — don't guess

Decided: The implementation phase must not assume which protocol the physical car runs. The first implementation task must probe the car by attempting a raw TCP connect to port 100 and separately attempting an HTTP GET to port 80, and then build the rest of the Connect flow around whichever one responds.

Why: The user does not know for certain whether their physical car runs the binary TCP:100 firmware or the HTTP:80 firmware (or a factory variant close to one of them). This can only be determined by testing against the actual hardware, not by reading source code alone.

Alternatives rejected: None — probing is necessary.

---

## Decision: Tech stack — Electron + TypeScript, no UI framework

Decided: Build with plain HTML/CSS + TypeScript (no React, Vue, or other frontend framework).

Why: The user wants something "really base." TypeScript provides compile-time safety for the IPC and socket code without the overhead of a full frontend framework for what is currently just a connect button and status indicator.

Alternatives rejected: None.

---

## Decision: Architecture — main process owns the TCP socket

Decided: The Electron main process (Node.js) holds the TCP connection to the car using Node's built-in `net` module. The renderer process (the web page / UI) interacts with the connection only via IPC messages and a preload script — never by performing raw socket I/O directly.

Why: Standard, secure Electron pattern. Enabling Node integration directly in the renderer to do sockets there would weaken Electron's process-isolation sandboxing, not justified even for a minimal app.

Alternatives rejected: None.

---

## Decision: Wi-Fi network joining is manual, not automated

Decided: The user will manually join the car's `ESP32-Car` Wi-Fi network via the normal macOS Wi-Fi menu before clicking Connect in the app. The app itself does not attempt to switch/join Wi-Fi networks programmatically (e.g., via `networksetup -setairportnetwork`).

Why: Keeps this ticket minimal. Auto-switching Wi-Fi adds macOS-specific shell-out logic and new failure modes (wrong network device name, permissions) that aren't needed for a first connect screen. If the TCP connect fails, the error state can hint at checking the Wi-Fi network.

Alternatives rejected: None.

---

## Decision: Config values are hardcoded constants, not a settings UI

Decided: The car's host IP (`192.168.4.1`), port (TBD — determined by port probing; either 100 or 80), and SSID (`ESP32-Car`) are hardcoded as constants in the source code (e.g., a `carConfig.ts` file). No settings UI is created.

Why: No settings UI is needed for a base connect screen. Easy to edit constants directly later if the user gets a second car or changes the password.

Alternatives rejected: None.

---

## Decision: UI control — single toggle button

Decided: One button whose label and behavior change with connection state: shows "Connect" when disconnected or in error, becomes disabled and shows "Connecting…" while connecting, and shows "Disconnect" once connected.

Why: Simpler than maintaining two separate Connect/Disconnect buttons with independent enabled/disabled logic.

Alternatives rejected: None.

---

## Decision: Connection-drop detection is automatic, not polled

Decided: After an initial successful TCP connect, the app must listen for the underlying socket's `close` and `error` events (not polling) and automatically update the displayed status if the connection drops later (car powered off, out of Wi-Fi range, etc.). A clean socket close transitions status to "disconnected"; an abrupt/error close transitions to "error." The renderer must never keep showing "Connected" after the socket has actually gone away.

Why: Without this, the UI could lie to the user about the actual connection state. Event-based detection is more efficient and accurate than polling.

Alternatives rejected: None.

---

## Decision: Packaging is dev-mode only — no signed `.app` or `.dmg` for this ticket

Decided: Running via `npm start` (or `electron .`) during development is sufficient for this ticket. Building a packaged, double-clickable, signed/notarized macOS `.app`/`.dmg` (e.g., via electron-builder) is explicitly out of scope and will be a separate ticket/plan once the app does more.

Why: Keeps this ticket minimal; packaging and code-signing are unrelated complexity for a first connect screen.

Alternatives rejected: None.

---

## Decision: Repository layout — new `app/` subdirectory

Decided: The Electron app's code (package.json, src/main.ts, src/preload.ts, src/renderer/) lives in a new `app/` subdirectory at the repo root, not directly at the repo root.

Why: Keeps the repo root clean for `docs/` and any future top-level additions (e.g., firmware code). This repo currently has no established layout convention, so a subdirectory is the right choice.

Alternatives rejected: None.

