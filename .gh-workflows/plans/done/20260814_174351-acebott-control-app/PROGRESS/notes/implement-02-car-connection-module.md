# Implement notes — 02-car-connection-module

## What was built

Two new framework-free modules in `app/src/`, plus a colocated test file, added to the `app/` scaffold from ticket 01. Nothing in `app/src/main.ts` or `app/src/preload.ts` was touched — per this session's explicit instructions, IPC/UI wiring is ticket 03/04's job; this module is self-contained and just needs to be imported later.

- **`app/src/carConfig.ts`** — plain exported constants: `CAR_IP` (`192.168.4.1`), `CAR_SSID` (`ESP32-Car`), `CAR_TCP_PORT` (100), `CAR_HTTP_PORT` (80), `CAR_PROBE_TIMEOUT_MS` (2500). No settings UI, matches spec.

- **`app/src/carConnection.ts`** — exports:
  - `CarConnection` class (extends `EventEmitter`). Constructor takes an optional `CarConnectionOptions` (`host`, `ssid`, `tcpPort`, `httpPort`, `timeoutMs`), all defaulting to the `carConfig` constants. This override is what makes the module testable without root privileges (ports 100/80 are privileged; tests bind mock servers to ephemeral ports instead).
  - `.getState(): ConnectionState` — synchronous read of current state.
  - `.connect(): Promise<void>` — runs the full probe sequence, resolves once settled into `connected` or `error`. Throws synchronously (before any I/O) if called while already `connecting` or `connected`.
  - `.disconnect(): Promise<void>` — throws if not currently `connected`; otherwise destroys the socket (see gotcha below) or, for an `http80` session with no persistent socket, sets `disconnected` directly.
  - `on("state-change", (state: ConnectionState) => void)` — fires on every transition. This is the event ticket 03 should subscribe to and forward over the status-push IPC channel; `getState()` is for one-off reads (e.g. answering a renderer's initial state request), not for the primary IPC wiring.
  - Types: `ConnectionStatus` (`"disconnected" | "connecting" | "connected" | "error"`), `CarProtocol` (`"tcp100" | "http80"`), `ConnectionState` (`{ status, protocol, message }`), `CarConnectionOptions`.

- **`app/src/carConnection.test.ts`** — 11 `node:test` cases against local mock `net`/`http` servers on ephemeral ports (no real ports 100/80 bound — that would need root). Covers: tcp100 success, tcp-preferred-over-http when both respond, http80 fallback when tcp100 is unreachable, http80 probe path is `/` with no `move` param, both-fail → error, connect-while-connecting rejects, connect-while-connected rejects, disconnect-while-not-connected rejects, user-initiated disconnect while connected, event-based clean remote close → disconnected, event-based abrupt remote close (RST) → error.

## State machine design

Four states, transitions matching the ticket exactly:
- `disconnected` → `connecting` on `connect()`.
- `connecting` → `connected` (with `protocol` set) once either probe succeeds, or → `error` if both fail.
- `connected` → `disconnected` on a clean socket close (locally or remotely initiated, `hadError === false`).
- `connected` → `error` on a socket `error` event (abrupt drop).
- `error` → `connecting` is allowed (retry); `connect()`/`disconnect()` reject synchronously for any other "doesn't make sense" combination (e.g. `disconnect()` while `disconnected`).

Drop detection is entirely event-based: the same `close`/`error` listeners are attached to the TCP socket from the moment it's created (before we even know if the probe will succeed), reused for the post-connect session. This avoids ever having a window where the socket has zero `error` listeners — an unhandled `error` on a `net.Socket` otherwise crashes the process. A `probeSettled` flag + `this.socket === socket` identity check in the shared listeners distinguish "this event is about the probe attempt" from "this event is about the live session."

## Sequential probe logic

`connect()` awaits `probeTcpAndHold()` first (raw `net.Socket.connect()` to `CAR_TCP_PORT`, no bytes written — matches the real firmware's `server.accept()`, which needs no handshake payload, confirmed by reading `docs/ACEBOTT QD001 - smart car - base/Python/5.Python Program/7.4APPControlCar.py`). Only if that fails/times out does it call `probeHttp()` (a `GET /`, never `/Car?move=...` — confirmed against `7.3Web_control_car.py` that only the `/Car?move=` path triggers movement). Whichever succeeds sets `protocol` on the resulting `connected` state; if neither responds within `timeoutMs` (2.5s default), state becomes `error` with a message that names both ports and hints at the `ESP32-Car` Wi-Fi network.

## Testing approach and results

Mock TCP/HTTP servers via `net.createServer()`/`http.createServer()` bound to `127.0.0.1:0` (ephemeral port), read back via `.address().port`. `node --test src/**/*.test.ts` (added as the `test` script in `app/package.json`).

**Result: 11/11 passing.** `npx tsc --noEmit` clean. `npm run build` produces `dist/carConfig.js`, `dist/carConnection.js`, `dist/main.js`, `dist/preload.js` (test file excluded from the build — see gotcha below). `npm start` launches cleanly (verified via `ps aux`, same process-level check ticket 01 used; still no way to visually confirm the window renders in this environment).

Two bugs were caught and fixed during test-writing, both worth knowing about for later car-control work:
1. **`disconnect()` originally called `socket.end()`, not `.destroy()`.** `.end()` only half-closes the write side and waits for the peer to close its side too — the mock server (and, presumably, the real car) has no reason to do that on its own, so the socket never reached `close` and the state stayed `connected` forever. Switched to `.destroy()`, which tears down unconditionally and deterministically reaches `disconnected` regardless of remote cooperation.
2. **Simulating an "abrupt drop" for the error-detection test isn't `socket.destroy(new Error(...))` server-side.** That only fires a local `error` event on the *server's* socket; it doesn't send an RST, so the client just sees a normal FIN (`disconnected`, not `error`). The fix was `socket.resetAndDestroy()` (Node ≥18.3), which actually sends a TCP RST the client observes as a real socket error.

## Known gotchas / assumptions

1. **HTTP:80 sessions have no persistent-connection drop detection.** Read `docs/.../7.3Web_control_car.py`: the example HTTP firmware accepts a connection, handles exactly one request, and closes — there's no session to hold open. So for an `http80`-protocol connection, `disconnect()` just resets local state immediately (no socket to close), and there is no way to detect the car going offline mid-session without polling, which the ticket explicitly forbids. This is a firmware constraint, not a gap in this module — flagging it clearly here since it's not spelled out in spec.md (spec.md's Further Notes flags the HTTP:80 probe *request* as an open question, not the session model). If a future ticket needs live "is the car still there" for the HTTP path, it will need a deliberate (and separately decided) polling strategy.
2. **Ports below 1024 need root to bind**, which is why `CarConnection`'s constructor accepts host/port/timeout overrides — not speculative generality, but the only way to test the probe logic locally without root. Production code (a future `main.ts` wiring in ticket 03) should just do `new CarConnection()` with no options to get the real `carConfig` values.
3. **Test runner: raw TypeScript via Node's built-in type stripping, no ts-node/tsx/build step.** Node 22.21.1 (installed here) runs `.ts` files directly (`node --test src/**/*.test.ts`), consistent with ticket 01's "no extra runtime dependency" philosophy and spec.md's `node:test` suggestion. This requires writing relative imports with an explicit `.ts` extension (e.g. `from "./carConfig.ts"`) so Node's native loader can resolve them; added `"rewriteRelativeImportExtensions": true` to `tsconfig.json` (TS ≥5.7, confirmed on the installed 5.9.3) so `tsc` correctly rewrites those to `.js` in the compiled output rather than erroring or leaving `.ts` in `require()` calls. **Any new file that imports another local `app/src/*.ts` file must use the `.ts` extension in the import path**, or it will fail both the raw-TS test run and (potentially) `tsc`.
4. **`tsconfig.build.json` was added** (extends `tsconfig.json`, excludes `src/**/*.test.ts`) and `app/package.json`'s `build` script now points at it (`tsc --project tsconfig.build.json`), so compiled test files don't end up in `dist/`. `typecheck` still uses the base `tsconfig.json` (no `--project` override), so test files stay type-checked. If ticket 03/04 add their own test files, no config changes are needed — they'll be picked up by both automatically as long as they match `src/**/*.test.ts`.
5. **A harmless Node warning appears on every test run**: `MODULE_TYPELESS_PACKAGE_JSON ... Reparsing as ES module`. This is Node noting that `app/package.json` has no `"type"` field, so it initially guesses CommonJS for the raw `.ts` test file, then re-detects ESM syntax. It's cosmetic (tests still run and pass) — did not add `"type": "module"` to `package.json` to silence it, since that could change how Electron loads the compiled `dist/main.js` (out of scope for this ticket, and ticket 01 deliberately chose a plain `tsc`-then-`electron .` CommonJS pipeline).
6. **Timeout/black-hole scenario not directly tested.** The "TCP:100 doesn't respond" fallback is tested via `ECONNREFUSED` (nothing listening on the probe port), which is what the ticket asked for ("probe fallback when TCP:100 doesn't respond") and resolves fast/deterministically. A genuine network-timeout (packet black hole, e.g. a non-routable IP) wasn't added as a dedicated test since it'd be slow and flaky in CI-like conditions; the `timeoutMs` code path itself (`socket.setTimeout` + `once("timeout", ...)`) is exercised implicitly by every probe call regardless of which failure mode fires first.

## Deferred: real hardware verification

The ticket's last acceptance criterion — confirming which protocol (TCP:100 binary vs HTTP:80) the physical QD001 car actually speaks — requires a human to physically join the `ESP32-Car` Wi-Fi network on their Mac. I have no network access to do this, so per this session's explicit instructions **I did not attempt it and did not mark the criterion done.**

**What the user needs to do:**
1. Join the `ESP32-Car` Wi-Fi network via the macOS Wi-Fi menu (password `12345678`, per the firmware source — the app doesn't automate this, by design).
2. Run the copy-pasteable Node one-liner in the ticket file's new "Manual verification" section (`.gh-workflows/plans/20260814_174351-acebott-control-app/tickets/02-car-connection-module.md`). It performs the exact same TCP:100-then-HTTP:80 probe the `CarConnection` module does, with the same no-movement guarantee, and prints which protocol responded.
3. Report back which protocol responded (or that neither did, in which case double-check the Wi-Fi join and car power).

Based on reading `docs/ACEBOTT QD001 - smart car - base/Python/5.Python Program/7.4APPControlCar.py` (the ACECode/Python example matching the "official app" binary protocol) vs `7.3Web_control_car.py` (the alternative HTTP example), TCP:100 is the more likely match for a car controlled via the official ACEBOTT phone app, but this is unconfirmed against the actual physical unit and the mock-server tests only prove the module's logic is internally consistent, not that it matches the real device.

## What ticket 03 needs to know

- Import `CarConnection` (and the `ConnectionState`/`ConnectionStatus`/`CarProtocol` types) from `app/src/carConnection.ts` — remember the `.ts` extension is required in the import path (see gotcha 3 above).
- Instantiate with `new CarConnection()` (no options) to get real `carConfig` values in production; main.ts should own exactly one long-lived instance.
- Wire the `connect`/`disconnect` IPC channels to call `.connect()`/`.disconnect()`. Both are `async` and reject on invalid-state calls (e.g. `connect()` while already `connecting`) — the IPC handler should catch/relay these rejections per spec.md's "reject if the action doesn't make sense in the current state."
- Wire the status-push IPC channel to the `"state-change"` event (`connection.on("state-change", (state) => ...)`), not to polling `getState()`. `getState()` is there for responding to a renderer's initial-state query if ticket 03/04 needs one before the first `state-change` fires.
- `ConnectionState` (`{ status, protocol, message }`) already matches the shape spec.md describes for the status-push payload — no reshaping should be needed, just forward it (or a superset of it) over IPC.
- Remember the HTTP:80 caveat (gotcha 1): if the real car turns out to speak HTTP:80, "connected" won't have live drop detection — worth surfacing to the user if that's the outcome of the manual verification step.
