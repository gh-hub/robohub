# 03 — Wi-Fi Log panel — live streaming end-to-end

**What to build:** end-to-end data flow from TCP socket to rendered log panel. `CarConnection` attaches a data listener on the tcp100 socket and emits timestamped lines via the shared buffering module from Ticket 2. A new IPC push channel forwards these lines from main to renderer process. Preload exposes a subscription function for the log lines. Renderer wires the Wi-Fi Log panel to real data, reading from the preload subscription and appending to the panel via the shared renderer from Ticket 2. When a user connects via the existing Wi-Fi Connect button and a mock or real TCP peer sends bytes, those bytes appear as timestamped lines in the Wi-Fi Log panel. When http80 disconnects or session ends, no new lines appear.

**Blocked by:** Ticket 02 (shared log-panel infrastructure)

**Status:** ready

- [x] `CarConnection` attaches a data listener on the tcp100 socket
- [x] Data listener emits timestamped lines via the shared buffering module
- [x] IPC channel created to push log lines from main process to renderer (`car:wifi-log-line`, `CAR_WIFI_LOG_LINE_CHANNEL` in `ipcChannels.ts`)
- [x] Preload script exposes a subscription API for log lines (`window.carAPI.onWifiLogLine(callback)`)
- [x] Renderer process wires subscription to Wi-Fi Log panel
- [x] Wi-Fi Log panel renders timestamped lines appended by the shared renderer
- [x] Connecting via Wi-Fi Connect button and sending bytes over TCP:100 shows timestamped lines in the panel — verified against a real mock TCP server (see new tests in `carConnection.test.ts`/`carIpcHandlers.test.ts`) and a headless Electron load-check with no JS errors; live end-to-end against the real car's firmware still needs manual verification (no hardware in this sandbox, per plan-wide gotcha)
- [x] Disconnecting or session ending stops appending new lines — the "log-line" event is only ever emitted while the tcp100 socket is open (per-session `LogLineBuffer`, no listener survives socket teardown); http80 sessions never emit it at all (covered by a dedicated test)
- [x] Lines are correctly timestamped and prefixed (reuses `LogLineBuffer`/`formatLogTimestamp` from ticket 02, already unit-tested; new tests confirm the `[HH:MM:SS.mmm]` format on real emitted lines)
- [x] Auto-scroll works as data streams in — inherited unchanged from `renderLogPanel()` (ticket 02); manual/DOM verification only, per spec.md's Testing Decisions (no automated DOM/browser layer in this suite)
