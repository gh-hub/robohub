# Implement notes — 03-ipc-bridge-preload

## What was built

Three new files in `app/src/`, plus edits to the two existing files ticket 01 left as placeholders (`main.ts`, `preload.ts`). No changes to `carConnection.ts` (production logic) — only its already-completed public API was consumed.

- **`app/src/ipcChannels.ts`** — the three IPC channel name constants, in their own Electron-free module so main, preload, and tests can all import them without pulling in `ipcMain`/`ipcRenderer`:
  - `CAR_CONNECT_CHANNEL = "car:connect"`
  - `CAR_DISCONNECT_CHANNEL = "car:disconnect"`
  - `CAR_STATUS_CHANNEL = "car:status"`
  (Namespaced with a `car:` prefix — not mandated by the ticket, but a reasonable low-risk choice to avoid future channel-name collisions as the app grows.)

- **`app/src/carIpcHandlers.ts`** — the plain, Electron-free handler logic:
  - `CarConnectionLike` — a narrow interface (`connect()`, `disconnect()`, `getState()`, `on`/`off("state-change", ...)`) that `CarConnection` satisfies structurally, but which lets tests pass a lightweight fake instead of a real socket-backed instance. (Note: `CarConnection` has private fields, so TypeScript's structural typing for classes would NOT let a duck-typed fake satisfy the concrete `CarConnection` type directly — hence the interface.)
  - `createCarIpcHandlers(connection: CarConnectionLike): CarIpcHandlers` — returns `{ handleConnect, handleDisconnect }`, each `() => Promise<void>`. **Deliberately does not resolve with `connection.getState()`** — see "Gotcha 1" below for why.
  - `forwardConnectionStatus(connection, sendStatus): () => void` — subscribes `sendStatus` to every `"state-change"` event; returns an unsubscribe function.

- **`app/src/carIpcHandlers.test.ts`** — 7 `node:test` cases: `handleConnect`/`handleDisconnect` call the right method exactly once and propagate rejections (using a `FakeCarConnection` — an `EventEmitter` implementing `CarConnectionLike` with spy call counts); `forwardConnectionStatus` forwards every event and its unsubscribe stops forwarding; plus one integration-style test that exercises `createCarIpcHandlers`/`forwardConnectionStatus` against a **real** `CarConnection` pointed at a local mock TCP server (same pattern as ticket 02's tests) — this is the automated stand-in for the ticket's "manually verified via devtools console" criterion (see "Manual verification" section below).

- **`app/src/main.ts`** — now the adapter layer: instantiates one `CarConnection()` (real production config) at module scope, registers `ipcMain.handle(CAR_CONNECT_CHANNEL, ...)` / `ipcMain.handle(CAR_DISCONNECT_CHANNEL, ...)` once at module scope, and inside `createWindow()`, calls `forwardConnectionStatus(carConnection, (state) => window.webContents.send(CAR_STATUS_CHANNEL, state))`, unsubscribing on the window's `"closed"` event (so a destroyed window's `webContents.send` is never called). `webPreferences` gained a `sandbox: false` line — see "Gotcha 2," this was a real bug fix, not a stylistic addition.

- **`app/src/preload.ts`** — now exposes `window.carAPI` via `contextBridge.exposeInMainWorld("carAPI", carAPI)`:
  ```ts
  interface CarApi {
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    onStatus: (callback: (state: ConnectionState) => void) => () => void;
  }
  ```
  Also augments the global `Window` interface (`declare global { interface Window { carAPI: CarApi } }`) so any renderer `.ts` file (ticket 04's job) gets `window.carAPI` typed for free under the same `tsconfig.json`.

## Exact preload API surface — what ticket 04 must call

```ts
window.carAPI.connect(): Promise<void>       // rejects if already connecting/connected
window.carAPI.disconnect(): Promise<void>    // rejects if not currently connected
window.carAPI.onStatus(callback: (state: ConnectionState) => void): () => void
  // callback fires on every state change; call the returned function to unsubscribe
```

`ConnectionState` is `{ status: "disconnected" | "connecting" | "connected" | "error"; protocol: "tcp100" | "http80" | null; message: string | null }` (unchanged from ticket 02, re-exported from `carConnection.ts`).

**There is no initial-state query API** (no `getStatus()`/`getState()` exposed). A fresh `CarConnection` always starts `disconnected`, so ticket 04's renderer should default its UI to the disconnected state on load and rely on `onStatus` for every update thereafter — this was a deliberate no-over-engineering call, not an oversight (the ticket's acceptance criteria list exactly three operations: connect, disconnect, status).

**`connect()`/`disconnect()` resolve on *initiation*, not on settled state** — per spec.md's IPC contract ("resolve once the action has been initiated ... the status-push channel is the single source of truth"). Ticket 04 should render exclusively from `onStatus` pushes, not from these calls' resolution. (See Gotcha 1 for why this matters concretely.)

## How it was tested

- **Unit level** (`carIpcHandlers.test.ts`, 6 of 7 tests): a `FakeCarConnection` (plain `EventEmitter` + spy counters implementing `CarConnectionLike`) verifies `handleConnect`/`handleDisconnect` call the right underlying method exactly once, propagate rejections, and that `forwardConnectionStatus` forwards/unsubscribes correctly. No Electron, no real sockets — matches spec.md's IPC-contract testing decision and general.md's "mock at system boundaries only" (the boundary here being `CarConnectionLike`).
- **Integration level** (1 test in the same file): a real `CarConnection` against a local mock TCP server, driven through `createCarIpcHandlers`/`forwardConnectionStatus` — the literal functions `main.ts` wires onto `ipcMain`/`webContents.send`. Asserts the connect flow pushes `connecting` then `connected`, and disconnect eventually pushes `disconnected`.
- **Contract-shape verification** (not committed — a throwaway script, deleted after use): launched the real, unmodified `dist/preload.js` inside an actual `contextIsolation: true` Electron `BrowserWindow` and confirmed `window.carAPI` exists with `connect`/`disconnect`/`onStatus` all typed `"function"`, and that `onStatus`'s returned unsubscribe function is itself callable — without ever invoking `connect()`/`disconnect()` (which would target the hardcoded production `CAR_IP`, forbidden in this session). This is what caught Gotcha 2 below; **it initially failed** before the `sandbox: false` fix.
- Full suite: `npm run typecheck` clean, `npm run build` clean (produces `dist/ipcChannels.js`, `dist/carIpcHandlers.js` alongside the updated `dist/main.js`/`dist/preload.js`), `npm test` — **18/18 passing**, confirmed stable across ~11 repeated runs (see Gotcha 3 for why repetition mattered).
- Real Electron launch (`npx electron .`) with the `sandbox: false` fix in place produces no console errors/warnings beyond Electron's routine unpackaged-app CSP notice.

## Gotchas / non-obvious decisions

1. **`connect()`/`disconnect()` handlers deliberately return `void`, not `ConnectionState`.** First attempt had `handleConnect`/`handleDisconnect` resolve with `connection.getState()`. This broke immediately for disconnect: `CarConnection.disconnect()` calls `socket.destroy()` and *returns before the `close` event fires* — so `getState()` read right after still says `"connected"` for a brief window. Returning the state from the handler would have handed the renderer a stale value contradicting spec.md's explicit "status-push channel is the single source of truth" design. Fixed by having the handlers resolve `void` once the action is *initiated* (matching spec.md's literal wording) and letting `forwardConnectionStatus`/`onStatus` be the only path to the real, settled state.

2. **`sandbox: false` is required in `webPreferences` for this multi-file preload to work at all — found via the automated preload-shape verification, not by inspection.** Electron defaults preload scripts to a restricted sandbox (when `nodeIntegration: false` and `sandbox` isn't explicitly set — the default since Electron ~20), whose module loader only resolves Electron/Node built-ins, not local relative `require()`s. Since `preload.ts` imports `CAR_CONNECT_CHANNEL` etc. from `./ipcChannels.ts`, the compiled `preload.js`'s `require("./ipcChannels.js")` failed silently at the Electron level (`Error: module not found`, visible only via `webContents.on("preload-error", ...)` or the devtools console) — `window.carAPI` was simply never exposed, no thrown exception visible anywhere in the main-process terminal output. **This would have silently broken ticket 04 from the start** had it not been caught here. Fix: added `sandbox: false` to `main.ts`'s `BrowserWindow` `webPreferences`. This does not weaken ADR-002's actual security guarantee — `contextIsolation: true` and `nodeIntegration: false` (the two properties that control what the *renderer/web content* can access) are untouched; `sandbox` only affects what our own trusted preload script's Node environment looks like.

3. **`carConnection.test.ts` (ticket 02's file) had a genuine, pre-existing race condition that intermittently hung the test suite forever** — discovered because the full-suite run hung (not failed) partway through in this session. Root cause, in two parts:
   - The "clean remote close" and "abrupt remote close" tests registered their `connection.once("state-change", resolve)` listener *after* `await connection.connect()` resolved. If the server's drop (`socket.end()`/`socket.resetAndDestroy()`) raced ahead and fired its `state-change` event in the gap between `connect()` settling and the listener being registered, the listener was registered too late and the test hung forever awaiting an event that had already happened. **Fixed** by registering an `.on` listener (not `.once`) *before* calling `connect()`, filtered to the specific terminal status being awaited (`"disconnected"` / `"error"`) so the intervening `"connecting"`/`"connected"` transitions from the probe itself don't resolve it prematurely.
   - Separately, `resetAndDestroy()` called *synchronously* in the server's `"connection"` handler can race the client's own `"connect"` event at the TCP-stack level — occasionally the client never observes a completed handshake before the RST arrives, so `CarConnection` treats it as a **failed probe attempt** ("car unreachable on both ports") rather than the intended scenario (a drop *after* reaching `"connected"`). Fixed by deferring the reset one tick (`setImmediate(() => socket.resetAndDestroy())`), which reproduced consistently once found (5+ failures in ~8 runs) and was 100% stable after the fix (11+ consecutive green runs).
   
   This was out of ticket 03's nominal scope (`carConnection.ts`/its tests are ticket 02's), but a hanging/flaky suite directly blocked this ticket's "confirm the full suite is green" requirement, so it was fixed rather than worked around. **No production code in `carConnection.ts` was touched** — only the two racy assertions in `carConnection.test.ts`.

4. **`handleConnect`/`handleDisconnect` don't need to catch and re-relay errors** — `CarConnection.connect()`/`.disconnect()` already reject synchronously for invalid-state calls; since the handlers are thin `async` wrappers, that rejection propagates through naturally, and `ipcMain.handle`'s own mechanism relays a handler's rejection to the renderer's `ipcRenderer.invoke()` promise automatically. No explicit try/catch was added (would violate general.md's "only handle errors at system boundaries" / "do not add fallbacks for scenarios that cannot happen").

5. **Existing `MODULE_TYPELESS_PACKAGE_JSON` warning** (noted in ticket 02's notes) still appears per test file on every `npm test` run — cosmetic, unchanged, still deliberately not silenced (see implement-02 notes gotcha 5 for why).

## What ticket 04 needs to know

- Import nothing new from `carIpcHandlers.ts`/`ipcChannels.ts` — the renderer talks exclusively to `window.carAPI` (typed globally via `preload.ts`'s `declare global`), never to IPC channel names or the connection module directly.
- Use `window.carAPI.onStatus(callback)` as the *only* source of truth for what to render; call `window.carAPI.connect()` / `.disconnect()` to trigger actions and `.catch()` their rejections (e.g. double-click protection, though the UI story's "Connecting…" disabled-button state should make invalid-state calls rare in practice — but they can still happen, e.g. a stray click event queued right before a state update re-renders the button).
- No initial-state query exists; assume `"disconnected"` until the first `onStatus` push.
- The HTTP:80 caveat from ticket 02 (no live drop detection for that protocol) still applies unchanged — nothing in this ticket's IPC layer works around it, since it's a firmware-level limitation, not something the IPC bridge itself controls.
