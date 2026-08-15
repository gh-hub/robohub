# Review round 1 — FAILED with 2 findings

## Gate results

- **Lint:** N/A (no tooling configured)
- **Build:** PASS
- **Unit/integration tests:** PASS (76/76, 0 failures)
- **E2E tests:** N/A (no suite configured)

## Summary

Round 1 review completed with **2 findings** blocking merge:

1. **Spec mismatch (connection-drop path):** `renderer.ts`'s `onStatus` handler calls `stopActiveMovement()` when the connection drops, which unconditionally sends Stop over IPC. The spec explicitly calls for a local-only state reset with NO send attempt on disconnect, since the connection is already gone. This splits the stop behavior (blur should send, disconnect should not). See [review/round-1/findings.md](../round-1/findings.md#spec-match) for full detail.

2. **Security gap (input validation):** The `car:set-movement` IPC handler accepts unvalidated `direction` strings with no runtime check before lookup in `MOVEMENT_VALUES`. TypeScript's type annotation is compile-time only; an arbitrary string/object/null flows through silently. See [review/round-1/findings.md](../round-1/findings.md#security) for full detail.

## Next steps

Two fix tickets created and ready to implement:

1. [review/round-1/tickets/01-connection-drop-local-reset.md](../round-1/tickets/01-connection-drop-local-reset.md) — split `stopActiveMovement()` or add a branch to skip IPC send on disconnect path only
2. [review/round-1/tickets/02-movement-direction-runtime-validation.md](../round-1/tickets/02-movement-direction-runtime-validation.md) — add explicit allowlist check at IPC boundary before `MOVEMENT_VALUES` lookup

Both are independent and can be implemented in parallel. Looping back to implement phase (round 1 within standard 2-round auto-fix limit; no user checkpoint needed).
