# Spec Session End-State

## Summary

Produced `spec.md` for the acebott-control-app plan: a full technical specification for a greenfield Electron + TypeScript desktop app (new `app/` subdirectory, confirmed not to exist yet) that connects to the ACEBOTT QD001 smart car over Wi-Fi/TCP and shows connection status via a single toggle button. The spec builds directly on the grill phase's requirements, decisions, glossary, and ADR-001/ADR-002, and adds:

- 14 user stories covering the connect/disconnect/status/drop-detection flow plus developer-facing concerns (config constants, process isolation, testability, forward-compatible status payload).
- Implementation decisions: main-process-owned framework-free connection module with a 4-state machine (`disconnected`/`connecting`/`connected`/`error`), sequential protocol probing (TCP:100 first, then HTTP:80, no movement side effects), a 3-channel IPC contract (`connect`/`disconnect` request-style, `status` push-style), constants-based config, and a pure status→UI mapping function in the renderer.
- Testing decisions: two primary seams — the car connection/protocol-probe module boundary (tested against local mock TCP/HTTP servers standing in for the car) and the IPC handler boundary (tested as plain functions, not via full Electron) — plus a secondary seam for the renderer's pure status-to-UI mapping function. Hardware-in-the-loop protocol confirmation is called out as manual/one-time, not automatable. Suggested `node:test` as the runner to avoid new dependencies, flagged as swappable.
- Out of scope: movement control, gun control, UI polish, packaging, Wi-Fi automation, settings UI, auto-reconnect, persistence, multi-device support, Bluetooth.
- Further Notes / open questions: exact probe timeouts, exact HTTP:80 probe path, whether to cache detected protocol across reconnects, test-runner choice is a suggestion not a hard requirement, and the risk that the whole port-100-vs-port-80 premise needs live hardware confirmation early in implementation.

## Codebase check performed

- Confirmed `app/` does not exist at repo root — this is a from-scratch Electron+TypeScript app, no existing code layout, `package.json`, or test conventions anywhere in the repo.
- Confirmed `docs/` contains only PDF/binary/firmware tutorial material (QD001 and QD005 kits) — no additional TypeScript/Electron conventions or protocol details beyond what `grill/requirements.md`'s "Environment notes" section already captured.
- No further exploration was needed beyond the environment notes already confirmed in the grill phase.

## Draft ticket breakdown

This is a DRAFT ONLY — ticket files have not been created and PROGRESS/INDEX.md ticket rows have not been added. The tickets phase should formalize these.

1. **Ticket 01 — Scaffold the Electron + TypeScript app skeleton** (prefactor)
   - Blocked by: none
   - Delivers: `app/` subdirectory with `package.json`, `tsconfig.json`, build/dev scripts, a minimal Electron main process that opens a blank window loading a placeholder `index.html`, and an empty preload stub with `contextIsolation` on / `nodeIntegration` off (per ADR-002). `npm start` runs the app. Nothing car-related yet — this ticket exists purely to make every subsequent ticket possible to build and test.

2. **Ticket 02 — Car connection module with protocol probing** (main process, framework-free)
   - Blocked by: 01
   - Delivers: the `carConfig` constants module (IP, SSID, ports), the TCP connection module wrapping `net.Socket` with the 4-state machine and `close`/`error` event listening, and the sequential port-100 → port-80 protocol probe. Fully covered by automated tests using local mock TCP/HTTP servers standing in for the car. This is also the ticket where the first manual, hardware-in-the-loop check happens: confirming against the real QD001 which protocol it actually speaks (de-risks everything downstream). No IPC or UI yet — demoable via test suite plus an optional small manual script.

3. **Ticket 03 — IPC bridge + preload contract**
   - Blocked by: 02
   - Delivers: `ipcMain` handlers for `connect`/`disconnect` wired to the ticket-02 connection module, the `status` push channel, and the preload script exposing the three-operation API via `contextBridge`. Handler logic written as plain functions (connection module as a dependency) so it's testable without spinning up full Electron IPC. Demoable via devtools console calling the exposed preload API and observing status pushes.

4. **Ticket 04 — Renderer UI: toggle button + status display**
   - Blocked by: 03
   - Delivers: the pure `ConnectionStatus → UI state` mapping function (tested as input/output pairs), HTML/CSS for the single toggle button and status area, and renderer wiring to the preload API. This is the ticket that completes the full user-facing feature end-to-end — click Connect in the real running app, see live status updates, click Disconnect, observe automatic drop detection — and is where final hardware verification against the physical car happens for the whole flow (not just the probe in isolation).

Sequencing is strictly linear (01 → 02 → 03 → 04) since each layer depends on the one below it; no parallelizable tickets in this small a feature.

## Next: tickets phase

The tickets phase should read this file plus `spec.md`, formalize the four tickets above (or adjust sizing if warranted), create ticket files under `tickets/`, and add rows to `PROGRESS/INDEX.md`.
