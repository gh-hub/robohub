# 01 — [spec] HTTP:80 drop detection must distinguish clean disconnect from error

**What to build:** When the periodic HTTP:80 liveness poll (added in round-1 fix 01) fails, the connection module must distinguish a clean/expected disconnect from an abrupt/error one, exactly like the TCP:100 path already does via `handleSocketClose(hadError)`. Currently `checkHttpLiveness()` in `app/src/carConnection.ts` always transitions to `DISCONNECTED_STATE` on any poll failure, with no branch for an error case — so a car that's powered off or walked out of range mid-session looks identical in the UI to a clean, expected disconnect. This violates the spec's explicit requirement (Solution section: "automatically flips the UI to 'disconnected' (clean close) or 'error' (abrupt close)") and User Story 9 ("a clean disconnect... visually distinguishable from an abrupt/error disconnect").

Investigate what distinguishing signal is actually available from a failed HTTP GET against this firmware (e.g. a connection-refused/ECONNREFUSED error vs. a timeout vs. some other failure mode) and use it to decide whether the poll failure should route to `error` (abrupt — e.g. connection refused, timeout, DNS failure, socket error) versus `disconnected` (clean — if there's any legitimate "expected" failure signal at all over polling; if not, the reasonable default is that essentially all http80 poll failures should be treated as `error`, since a poll silently going unanswered is inherently an unexpected/abrupt event, not a clean handshake-based disconnect the way a TCP `close` event is). Update the corresponding test (the one currently titled "...goes to disconnected" for what is really an abrupt-disappearance scenario) to assert the correct state, and add any additional test coverage needed for the newly distinguished branch.

**Blocked by:** None — can start immediately

**Status:** ready

- [x] `checkHttpLiveness()`'s failure path distinguishes clean/expected disconnects (if any such signal exists over HTTP polling) from abrupt/error ones, transitioning to `disconnected` or `error` accordingly — not unconditionally to `disconnected`
- [x] The design decision (what counts as "clean" vs "error" for an HTTP poll failure, and why) is documented in a code comment
- [x] Existing test(s) that were asserting the wrong state for an abrupt-disappearance scenario are corrected to assert the right one
- [x] New/updated automated test coverage confirms both branches (if both are reachable) work correctly
