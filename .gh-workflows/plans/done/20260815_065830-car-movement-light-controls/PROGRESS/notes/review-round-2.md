# Review Round 2

## Findings summary

Automated gate results:
- Lint: N/A (no lint tooling configured)
- Build: PASS
- Tests: PASS (78/78)
- E2E: N/A (no e2e suite configured)

Spec-match review: no issues found — both round-1 fixes verified correct.

Security review: 1 finding — prototype-chain bypass in the round-1 allowlist fix.

**Round 2 FAILED** (1 security finding). One fix ticket created. Looping back to implement (no user checkpoint needed; this is round 2, within the standard 2-round auto-fix limit).

See [review/round-2/findings.md](../review/round-2/findings.md) for full details.

## Fix ticket

**01 — Fix prototype-chain bypass in movement-direction allowlist check**
Path: `.gh-workflows/plans/20260815_065830-car-movement-light-controls/review/round-2/tickets/01-fix-prototype-chain-allowlist-bypass.md`

The `isMovementDirection()` guard in `carIpcHandlers.ts` uses `value in MOVEMENT_VALUES`, which incorrectly passes inherited `Object.prototype` property names (`"constructor"`, `"toString"`, `"__proto__"`, etc.) because the `in` operator walks the prototype chain. When these strings are passed, `MOVEMENT_VALUES[value]` returns a non-numeric function/object, which is silently coerced to byte 0 in the buffer — reintroducing the exact bug the round-1 fix was supposed to close (unvalidated string silently becomes "stop").

Fix: replace `in` with own-property check (`Object.prototype.hasOwnProperty.call()`, or `Set`/array membership instead).
