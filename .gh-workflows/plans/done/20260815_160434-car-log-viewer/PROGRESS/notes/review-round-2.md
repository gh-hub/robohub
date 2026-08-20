# Review round 2 — findings summary

## Gate results
- Lint: N/A — no lint command/config exists in this project
- Build (typecheck, both tsconfig projects): PASS
- Unit/integration tests: PASS (218/218)
- E2E tests: N/A — no e2e suite exists in this project

## Round-1 fixes verified
All three round-1 fixes verified as correctly landed: `UsbSerialConnection.connect()` now always resolves once initiated and mirrors `CarConnection`'s contract exactly; new `CAR_USB_LOG_STATUS_CHANNEL` pushes connect success/failure to the renderer; renderer shows a visible operator-facing message via `mapUsbLogControlUiState()`; and `"dev"` script is gone from `app/package.json`.

## New spec-match gap
Port can leak past an "error" event: in `attachSessionListeners()`, a non-closing `"error"` event (e.g. a failed write) sets status to `"error"` but never calls `port.close()` or clears the internal port reference, leaving the OS-level serial handle open/locked with no code path to release it. See [findings](../round-2/findings.md) for details.

## Scope creep noted
`LogLineBuffer`'s `MAX_PENDING_LENGTH` discard behavior isn't documented in spec.md's buffering decision, though it's a deliberate, justified security fix. Spec.md needs updating to reflect this required behavior.

## New security finding
Unbounded per-line emission rate (resource-exhaustion DoS): the round-1 cap only bounds the unterminated partial buffer, not how many complete lines a single chunk can produce. A chunk of mostly newlines (from firmware misbehavior or a LAN attacker spoofing the car's TCP endpoint) can stall the Electron main process and freeze the renderer via tens of thousands of back-to-back IPC sends and DOM reflows. See [findings](../round-2/findings.md) for full detail.

## Next
Three fix tickets under [review/round-2/tickets/](../round-2/tickets/), starting with [01-security-batch-emit-log-lines.md](../round-2/tickets/01-security-batch-emit-log-lines.md).
