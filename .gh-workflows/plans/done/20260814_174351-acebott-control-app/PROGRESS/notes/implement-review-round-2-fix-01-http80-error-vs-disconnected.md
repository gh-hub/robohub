# Implement notes: review/round-2 fix 01 — http80 error vs. disconnected

## What was fixed

Round-2 review Finding 1: `checkHttpLiveness()` in `app/src/carConnection.ts` unconditionally
transitioned to `DISCONNECTED_STATE` on any failed liveness poll, with no branch distinguishing a
clean/expected disconnect from an abrupt/error one — unlike the TCP:100 path's
`handleSocketClose(hadError)`, which correctly branches on `hadError`. This violated the spec's
"disconnected (clean close) or error (abrupt close)" requirement and User Story 9.

**The exact change:** in `checkHttpLiveness()`'s failure branch, replaced
`this.setState({ ...DISCONNECTED_STATE })` with a transition to `error`:

```ts
this.setState({
  status: "error",
  protocol: null,
  message: `Car stopped responding at ${this.host}:${this.httpPort} (HTTP).`,
});
```

**Reasoning for treating ALL http80 poll failures as `error`, never `disconnected`:** investigated
`probeHttp()` (the same GET reused for polling) and confirmed it collapses every failure mode —
connection-refused, timeout, DNS failure, socket error — into a single `resolve(false)`; no error
object, code, or reason ever reaches the caller (see the three `settle(false)` call sites: the
`timeout` listener and the `error` listener on the request). Even if that information were
threaded through, there is no legitimate "the car cleanly told me it's disconnecting" signal over
one-shot HTTP polling in the first place — unlike TCP's `close` event, which fires with
`hadError: false` even on a graceful FIN, a poll that simply goes unanswered is inherently an
unexpected/abrupt event. So every reachable failure path for a poll now routes to `error`.
`disconnected` is still reachable for an http80 session — through the user's own `disconnect()`
call (`CarConnection.disconnect()`), which is untouched by this fix and remains the one genuinely
clean path.

This decision is documented in two places in `app/src/carConnection.ts`:
1. The class-level doc comment (above `export class CarConnection`), which now explains the
   TCP-vs-HTTP asymmetry in clean/abrupt signal availability.
2. An inline comment directly above the new `error` transition in `checkHttpLiveness()`.

## How it was tested

- Renamed/corrected the existing test that was asserting the wrong state for what is really an
  abrupt-disappearance scenario: `"an http80 session detects a drop via periodic liveness polling
  and goes to disconnected"` → `"...and goes to error"`. It now waits for a `state.status ===
  "error"` event (previously `"disconnected"`) and asserts `status: "error"`, `protocol: null`,
  and a `message` matching `/stopped responding/`.
- Added a new test, `"disconnect() on an http80 session cleanly transitions to disconnected (not
  error)"`, which connects over http80, calls `disconnect()`, and asserts the final state is
  exactly `DISCONNECTED_STATE` (`status: "disconnected"`, `protocol: null`, `message: null`) — this
  is what now proves `disconnected` is still reachable for an http80 session, just via a different
  path than the poll-failure branch.
- The other existing http80 test (`"disconnect() on an http80 session stops the liveness poll (no
  leaked timer)"`) was left as-is; it only asserts request-count behavior, not final state, so it
  didn't need correcting.
- Ran `npm run typecheck` after the production-code edit and again after the test edits — clean
  both times.
- Ran the full suite (`npm test`, `node --test src/**/*.test.ts`): 28/28 pass (was 27; net +1 test
  — one renamed/corrected in place, one new one added).
- Ran `npm run build` (`tsc --project tsconfig.build.json && tsc --project tsconfig.renderer.json`):
  clean, no errors.

## Gotchas / assumptions

- **Assumption (explicitly sanctioned by the ticket's own guidance and the fix-ticket prompt):**
  there is no reachable "clean disconnect" signal from a failed HTTP poll, so the fix does not add
  a second branch inside `checkHttpLiveness()` — only one failure path exists now, and it always
  produces `error`. This is a deliberate, no-over-engineering choice: adding an unreachable
  `disconnected` branch inside the poll-failure path itself would be dead code with no test able to
  exercise it honestly. `disconnected` for http80 remains fully reachable, just via
  `disconnect()`, not via `checkHttpLiveness()`.
- No production code outside `checkHttpLiveness()` and its surrounding doc comment changed.
  `probeHttp()` itself was not touched — its boolean-only return shape was confirmed sufficient
  for this fix's needs (see Reasoning above).
- `CONTEXT.md` gotcha 6 (about http80 drop detection) was outdated after this fix — it previously
  said a dropped http80 session "always" shows `disconnected`, never `error`. That gotcha is
  updated as part of this session's `CONTEXT.md` edit to reflect the corrected behavior.

## What's next

This was the only fix ticket in round-2. Per the workflow's 2-round auto-fix limit, both
auto-fixable review rounds have now been used (round-1 had 2 findings, round-2 had 1 — both fixed
without a live user checkpoint). **review/round-3 is next, and it is the first round where a
review failure would require a live user continue/stop decision** — the auto-fix budget is
exhausted, so if round-3 fails, the workflow must stop and ask the user how to proceed rather than
auto-generating another fix ticket.
