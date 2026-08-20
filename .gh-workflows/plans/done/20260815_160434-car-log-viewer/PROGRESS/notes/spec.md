# Session end-state: spec phase

## What happened this session

Read `CONTEXT.md`, `grill/requirements.md`, `grill/decisions.md`, `grill/glossary.md`, and `grill/ADR-001.md`. Explored the codebase beyond what `requirements.md`'s "Environment notes" already covered: `app/src/carConnection.ts`, `app/src/usbStatus.ts`, `app/src/main.ts`, `app/src/carIpcHandlers.ts`, `app/src/ipcChannels.ts`, `app/src/preload.ts`, `app/src/renderer.ts`, `app/src/connectionUiState.ts`, `app/public/index.html`, `app/package.json`, and the existing test files (`carConnection.test.ts`, `carIpcHandlers.test.ts`, `usbStatus.test.ts`, `connectionUiState.test.ts`) to confirm established test seams and patterns before writing the spec.

Wrote `spec.md` (Problem Statement, Solution, 16 User Stories, Implementation Decisions, Testing Decisions, Out of Scope, Further Notes).

## Key seam decisions carried into the spec

- Reuse `CarConnection`'s existing `EventEmitter` state-change pattern to add a new, additive "log line" event for the tcp100 socket — no change to the existing connect/disconnect state machine.
- New USB-serial-owning module mirrors `CarConnection`'s shape: injectable dependencies, reject-synchronously-in-wrong-state lifecycle methods, same emitter pattern — testable via a fake in-memory serial implementation, never real `serialport` bindings or hardware.
- One shared VID/PID auto-detect helper (hex-normalizing) used by both the rewritten presence badge and the new USB Log connect action — matching rule lives in exactly one place.
- Byte-to-line buffering/newline-splitting/timestamping logic is a pure, directly-unit-testable module shared by both the Wi-Fi and USB log paths.
- Renderer log-panel append/cap/auto-scroll/Clear logic extracted as one reusable pure function shared by both panels, following the existing UI-state-mapper pattern in `connectionUiState.ts`.
- New IPC channels (two log-line push channels, two USB connect/disconnect action channels) follow the exact existing channel patterns in `ipcChannels.ts`/`carIpcHandlers.ts`/`preload.ts`/`main.ts`.

## Draft ticket breakdown

1. **Add `serialport` dependency; fix USB presence badge cross-platform**
   Blocked by: none.
   Delivers end-to-end: `serialport` added as the app's first runtime dependency, with its native-module rebuild step wired into the build/start scripts; `usbStatus.ts` rewritten to call `SerialPort.list()` with VID/PID matching (0x1A86/0x7523), dropping the macOS-only `process.platform` branch entirely; existing polling/push-on-change shape unchanged. Demoable: the badge correctly shows "USB: Connected" when the car is plugged in on Windows (previously always "Not connected"), and keeps working on macOS.

2. **Shared log-panel infrastructure (buffer, timestamp, render, clear)**
   Blocked by: none.
   Delivers end-to-end: a pure, shared byte-to-line buffering/newline-splitting/timestamp-prefixing module; a pure, shared renderer append-with-cap(500)/auto-scroll/Clear module; two empty log-panel DOM elements (with Clear buttons) added to the existing single window, wired to the new renderer module with no live data source yet. Demoable: both empty panel shells render correctly and their Clear buttons work on inert/empty state — sets up the seam both feature tickets below plug into.

3. **Wi-Fi Log panel — live streaming end-to-end**
   Blocked by: Ticket 2.
   Delivers end-to-end: `CarConnection` attaches a data listener on the tcp100 socket and emits timestamped lines via the shared buffering module; new IPC push channel forwards lines to the renderer; preload exposes the subscription; renderer wires the Wi-Fi Log panel to real data. Demoable: connecting via the existing Wi-Fi Connect button and having a mock/real TCP peer send bytes shows them appear as timestamped lines in the Wi-Fi Log panel; http80/disconnected sessions show no new lines.

4. **USB Log panel — connect/stream/disconnect end-to-end**
   Blocked by: Ticket 1, Ticket 2.
   Delivers end-to-end: new USB-serial-owning module (open at 115200 baud via the shared VID/PID helper from Ticket 1, read, close) with injectable-dependency testability; new IPC channels for USB Log connect/disconnect actions and log-line push; preload + renderer wiring; new Connect/Disconnect button mirroring the existing Wi-Fi toggle pattern; port closes cleanly on Disconnect click and on app close. Demoable (with real CH340 hardware): clicking Connect opens the auto-detected port and streams timestamped lines into the USB Log panel; clicking Disconnect (or closing the app) releases the port for other tools.

## Open questions / risks (see spec.md "Further Notes" for full detail)

- Firmware log line format (newline-delimited) is assumed, not yet confirmed against real richer log content.
- Exact `electron-rebuild`/`@electron/rebuild` wiring for `serialport`'s native module hasn't been prototyped.
- No CH340 test hardware available in this environment — Tickets 1 and 4's hardware-facing behavior needs manual verification against the real car.
- Windows-specific `serialport` quirks (COM port naming, drivers) are unverified.

## Next phase
`tickets` — turn the draft breakdown above into real ticket files under `tickets/` and rows in `PROGRESS/INDEX.md`, pending user approval of `spec.md`.
