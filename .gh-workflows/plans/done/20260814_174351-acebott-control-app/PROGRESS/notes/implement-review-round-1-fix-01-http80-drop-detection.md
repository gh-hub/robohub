# Implement: round-1 fix 01 — HTTP:80 drop detection

## What was fixed

Review round 1, Finding 1: an http80-connected session had zero drop
detection — `probeHttp()` was (and still is) a one-shot GET with no retained
socket, so nothing watched for the car going away once connected via
HTTP:80. The spec requires drop detection unconditionally across both
protocols, not scoped to TCP.

## Mechanism chosen: periodic liveness polling (code fix, not a documented limitation)

Investigated the HTTP:80 example firmware
(`docs/ACEBOTT QD001 - smart car - base/Python/5.Python Program/7.3Web_control_car.py`):
it's a synchronous MicroPython socket loop —
`cl, addr = s.accept(); ...; cl.send(response); cl.close()` — that accepts
one connection, serves exactly one request, and closes. There is no way to
keep a connection open across requests (no HTTP keep-alive support, no
Connection: header handling at all), so "hold the http socket open like
TCP:100 does" is not an option this firmware offers.

However, `GET /` (the same request already used for the initial probe) is
genuinely idempotent and side-effect-free — the firmware only triggers
movement when the request line contains `/Car?move=`, and requesting `/`
just returns the static control-page HTML. That makes it safe to repeat
indefinitely, which is exactly the situation the ticket's polling exception
was written for ("no event-based primitive exists over one-shot HTTP").

Implementation (`app/src/carConnection.ts`):
- `CarConnection.startHttpLivenessPolling()` is called right after a
  successful http80 connect. It runs a `setInterval` (not `unref()`'d — see
  Gotchas) at `CAR_HTTP_POLL_INTERVAL_MS` (5000ms, new constant in
  `app/src/carConfig.ts`), each tick invoking `checkHttpLiveness()`.
- `checkHttpLiveness()` re-runs the same `probeHttp()` function used for the
  initial probe. A `httpPollInFlight` guard skips a tick if the previous
  GET hasn't settled yet (avoids stacking concurrent requests against the
  firmware's single-connection accept loop if a poll ever takes longer than
  the interval). On failure, and only if the connection is still `connected`
  + `http80` (guards against a race with a manual `disconnect()` that
  happened while the GET was in flight), it stops the poll and transitions
  to `disconnected` — the same terminal state TCP's clean-close path
  reaches. (There's no way to distinguish a "clean" vs. "abrupt" http80 drop
  the way TCP's `close` vs `error` events do — a failed/timed-out GET is a
  single boolean signal — so `disconnected` rather than `error` was the
  reasonable choice; it's already the more common real-world case: Wi-Fi
  moving out of range or the car powering off.)
- `disconnect()` now calls `stopHttpLivenessPolling()` unconditionally
  before checking `this.socket`, so a manual disconnect on an http80 session
  clears the timer immediately — no leaked interval.
- `CarConnectionOptions` gained an optional `httpPollIntervalMs` (mirrors
  the existing `timeoutMs` override pattern) so tests can run the poll fast
  instead of waiting on the 5s production default.

## Testing

Two new tests in `app/src/carConnection.test.ts` (existing local mock HTTP
server pattern, no real network):
1. **"an http80 session detects a drop via periodic liveness polling and
   goes to disconnected"** — connects via http80 with a 20ms poll interval,
   then closes the mock HTTP server (simulating the car going away) and
   asserts the connection reaches `{ status: "disconnected", protocol: null,
   message: null }` via a `state-change` event, without ever calling
   `disconnect()`.
2. **"disconnect() on an http80 session stops the liveness poll (no leaked
   timer)"** — connects via http80 with a 20ms poll interval, calls
   `disconnect()`, then waits 80ms (4 poll intervals) and asserts no further
   requests hit the mock server.

Full suite: `npm test` → 27/27 passing (was 25 before this ticket; the 2
new tests above account for the delta). `npm run typecheck` and
`npm run build` (`tsc --project tsconfig.build.json && tsc --project
tsconfig.renderer.json`) both clean.

## Gotchas

1. **Do not `.unref()` the poll timer, even though it seems like the
   "safe default" for a background interval.** I tried it first (as a
   defensive measure against keeping the test process alive on a lingering
   timer) and it broke both new tests: `node --test` apparently treats a
   fully-unref'd timer as "no remaining work" and force-cancels the still-
   pending test promise ("Promise resolution is still pending but the event
   loop has already resolved") rather than letting the interval fire. Since
   `stopHttpLivenessPolling()` is reliably called on every exit path
   (manual disconnect, detected drop), a ref'd timer never actually leaks —
   it's always cleared by the code, not by process-exit semantics — so there
   was no upside to unref'ing it worth the test breakage.
2. **Two pre-existing tests (`connect() falls back to http80...` and
   `http80 probe requests a bare path...`) connected via http80 and never
   called `disconnect()`.** Before this fix that was harmless (no timer to
   leak). After adding polling, those tests left a live 5000ms-interval
   `CarConnection` behind at test-file exit; because the mock HTTP server is
   torn down in `afterEach`, the leaked poll would eventually (after the
   full 5s production interval) fail, self-detect, and clear itself — which
   is what happened, but it added ~5 real seconds to every `npm test` run
   while it waited that out. Fixed by adding `await connection.disconnect()`
   at the end of both tests. Full suite is back to ~250ms.
3. **This ticket does not touch `app/src/main.ts` or its `sandbox`
   setting.** Confirmed via `git diff --stat app/src/main.ts` showing no
   changes from this session — that's fix-ticket 02's scope
   (`review/round-1/tickets/02-sandbox-false-review.md`), separately
   pending.
4. **API surface change for fix-02 (or a future reviewer) to be aware of:**
   `CarConnectionOptions` gained a new optional field `httpPollIntervalMs`,
   and `CarConfig.ts` gained a new exported constant
   `CAR_HTTP_POLL_INTERVAL_MS`. Neither `main.ts` nor `carIpcHandlers.ts`
   construct `CarConnection` with any options overrides today, so this is
   additive/backward-compatible — no other file needed updating.
5. **spec.md was intentionally left unchanged.** The ticket's acceptance
   criteria only required a Further Notes update if a documented-limitation
   path were taken instead of a code fix; since a working code fix was
   feasible and implemented, that criterion is N/A (checked off as such in
   the ticket file).
