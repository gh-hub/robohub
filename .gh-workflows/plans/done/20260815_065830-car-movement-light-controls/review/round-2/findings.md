# Review round 2 findings

## Spec match

**Round 2 Review Report**

**Round-1 fixes verified — both correct.**

1. `renderer.ts` now has `stopActiveMovement()` (send+clear, wired to `blur`/`pointerup`/`pointerleave`/`pointercancel`) and a separate `clearActiveMovement()` (local-only `activeDirection = null`, wired into `onStatus`'s `if (state.status !== "connected" || state.protocol !== "tcp100")` branch). Matches spec: "clear `activeDirection`... without attempting to send... this is a local state reset, not a new Stop-sending path."
2. `carIpcHandlers.ts` adds `isMovementDirection()` (`typeof value === "string" && value in MOVEMENT_VALUES`) and `handleSetMovement` rejects with `Invalid movement direction: ...` before calling `connection.setMovement()`. Tested for both an invalid string and an empty string (`carIpcHandlers.test.ts:169-197`), confirming `setMovementCalls` stays empty.

**Full spec re-check — no other issues found.**

- Lights collapsed to single `#light-button` (index.html, renderer.ts, connectionUiState.ts comment updated) — "Lights: On/Off" label per story 2. `commandFrame.ts`/`carConnection.ts`/`ipcChannels.ts` untouched for lights as spec required.
- `DEVICE_MOTOR = 0x0c`, `MOVEMENT_VALUES` table matches spec's value table exactly.
- `CarConnection.setMovement()` mirrors `setLedState()`'s gating exactly, verified by wire-byte tests against a mock TCP server and http80/disconnected rejection tests.
- `car:set-movement` channel, `preload.ts` surface, `main.ts` wiring all present and type-consistent.
- `mapMovementControlUiState` gates identically to lights, fully tested across all four other states.
- D-pad layout matches story 11. Interrupt/no-stale-stop semantics match stories 9–10.
- `npm run typecheck` and `npm test` both pass (78/78 tests).

No scope creep, no missing/partial requirements, no incorrect-looking-correct implementations found.

## Security

### Fix verification: correctly placed, but has a validation gap

`handleSetMovement` in `app/src/carIpcHandlers.ts:385-390` does sit at the trust boundary before any call into `CarConnection.setMovement()` → `sendCommandFrame()` → `socket.write()`, so the round-1 fix's placement is right — no path bypasses it (main.ts, preload.ts all funnel through this handler).

### Insufficient input validation — allowlist check uses `in`, which walks the prototype chain

```ts
function isMovementDirection(value: unknown): value is MovementDirection {
  return typeof value === "string" && value in MOVEMENT_VALUES;
}
```

`MOVEMENT_VALUES` is a plain object literal, so `"constructor" in MOVEMENT_VALUES` is `true` (inherited from `Object.prototype`), as are `"toString"`, `"hasOwnProperty"`, `"valueOf"`, `"__proto__"`, `"isPrototypeOf"`, `"propertyIsEnumerable"`, `"toLocaleString"`. Verified directly:

```
constructor true function
toString true function
...
__proto__ true object
```

A renderer calling `carAPI.setMovement("constructor")` passes `isMovementDirection` (not a valid `MovementDirection`), then `MOVEMENT_VALUES["constructor"]` returns the `Object` constructor function (not a number). This function is assigned to `payload[9]` in `buildCommandFrame` (`app/src/commandFrame.ts`), which Node coerces via `Buffer` numeric-write semantics to `0` — silently writing the same byte as `"stop"` for a string the allowlist was supposed to reject outright. This is the exact bug class the round-1 fix claimed to close (an unvalidated string silently resolving to byte 0 instead of being rejected) — it just narrows the set of strings that can trigger it from "anything" to these 8 specific inherited-property names. Fix: use `Object.prototype.hasOwnProperty.call(MOVEMENT_VALUES, value)` or a `Set`/array `.includes()` instead of `in`.

No other new issues found — `contextIsolation: true`/`nodeIntegration: false` remain intact in `main.ts`, no secrets/logging/XSS/SSRF/path-traversal issues introduced by this diff.

## Automated checks

- **Lint:** N/A — no lint tooling configured anywhere in this project.
- **Build:** PASS — `npm run build` completed cleanly, no errors.
- **Unit/integration tests:** PASS — `npm test` in `app/`: 78/78 passing, 0 failures, no reruns needed (not flaky).
- **E2E tests:** N/A — no e2e suite configured.
