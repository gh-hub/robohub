# Review round 1

## Gate results
- Lint: N/A — no lint command/config exists in this project
- Build (typecheck, both tsconfig projects): PASS
- Unit/integration tests: PASS (206/206)
- E2E tests: N/A — no e2e suite exists in this project

## Findings

**Spec match gaps:**

1. **USB Log connect() contract mismatch**: `UsbSerialConnection.connect()` rejects asynchronously on failure (no CH340 found, port open error), diverging from spec.md's requirement to mirror Wi-Fi's contract (resolve once initiated, reject only synchronously for invalid state). No status-push channel exists for USB Log, so failure is only visible via console.error, with no operator-facing UI explanation.

2. **Scope creep — unrequested "dev" script**: `app/package.json` added `"dev": "npm run start"`, which is not mentioned in spec.md's Implementation Decisions and is redundant with the existing `"start"` script.

**Security finding:**

3. **Unbounded memory growth (DoS) in LogLineBuffer**: `LogLineBuffer.push()` appends every incoming chunk to an internal `pending` string with no size cap. A peer (car firmware, LAN attacker, or malfunctioning USB-serial device) sending an endless stream of bytes with no newline can grow the buffer without bound, exhausting the Electron main process's memory and crashing the app. The buffer is fed directly from raw socket bytes in both `carConnection.ts` and `usbSerialConnection.ts` call sites, with no bounds checking before `push()` is called.

See [findings](../round-1/findings.md) for full detail.

Next: three fix tickets under `review/round-1/tickets/`, starting with `01-security-cap-log-line-buffer.md`.
