# 03 — IPC bridge + preload contract

**What to build:** `ipcMain` handlers for connect/disconnect wired to the connection module, a status push channel delivering live updates to the renderer, and a preload script exposing the three-operation API via `contextBridge`, all testable as plain functions independent of full Electron IPC.

**Blocked by:** 02 — Car connection module with protocol probing

**Status:** done

- [x] `ipcMain` handlers for `connect` and `disconnect` implemented and wired to the connection module
- [x] `status` push channel sends updates to the renderer on state changes
- [x] Preload script exposes `connect`/`disconnect`/`status` via `contextBridge`
- [x] Handler logic is testable as plain functions independent of full Electron IPC
- [x] Manually verified via devtools console: calling exposed API triggers connect/disconnect and status pushes arrive — **verified via automated equivalents, not an interactive devtools session** (no interactive Electron devtools available in this agent environment, and calling `connect()` against the real app would target the hardcoded production `CAR_IP` (192.168.4.1), which this session must not attempt to reach — see plan CONTEXT.md gotchas). Two-part verification instead: (1) `src/carIpcHandlers.test.ts`'s integration test drives `createCarIpcHandlers`/`forwardConnectionStatus` — the exact code `main.ts` wires to `ipcMain`/`webContents.send` — against a real `CarConnection` and a local mock TCP server, asserting connect/disconnect calls and status pushes all fire correctly; (2) a one-off headless script launched the real built `dist/preload.js` in an actual `contextIsolation:true` Electron renderer and confirmed `window.carAPI` is exposed with `connect`/`disconnect`/`onStatus` as functions (via `contextBridge`, never calling `connect()`/`disconnect()` themselves) — this caught and led to fixing a real bug (see notes: `sandbox: false` needed for preload's local `require`s to resolve).
