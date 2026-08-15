# 01 — [spec] Connection-drop movement Stop must be a local state reset, not an IPC send

**What to build:** In `app/src/renderer.ts`, the `onStatus` handler's connection-drop path (currently calling `stopActiveMovement()`, which unconditionally calls `sendMovement("stop")` over IPC) must instead do a purely local reset of `activeDirection` to `null` with NO `window.carAPI.setMovement(...)` call — because `CarConnection.setMovement()` already rejects synchronously once the session leaves `connected`+`tcp100`, so attempting a send here is pointless and contradicts the spec's explicit design ("this is a local state reset, not a new Stop-sending path"). Keep the existing `window.blur` handler's behavior unchanged — that path SHOULD still call `sendMovement("stop")` since the connection is still live there; only the connection-status-drop path in `onStatus` changes. Likely means splitting `stopActiveMovement()` into two distinct helpers (e.g. a send-and-clear one for blur/pointerup/pointerleave/pointercancel, and a clear-only one for the `onStatus` disconnect path), or adding a parameter/branch to avoid the network call specifically in the `onStatus` case.

**Blocked by:** None — can start immediately

**Status:** ready

- [x] onStatus handler's disconnect path clears activeDirection without calling window.carAPI.setMovement
- [x] window.blur handler still sends Stop via window.carAPI.setMovement when a direction is active
- [x] pointerup/pointerleave/pointercancel handlers unaffected (still send Stop when releasing the active direction)
- [x] Full test suite and build still pass after the change (no automated test regressions; this remains DOM-wiring logic not itself unit-tested, per existing convention, but must not break any existing test)

**Resolution:** Split `stopActiveMovement()` into two helpers in `app/src/renderer.ts`: `stopActiveMovement()` (unchanged send-and-clear, now used only by `window.blur`) and a new `clearActiveMovement()` (local-only, sets `activeDirection = null` with no IPC call), used by the `onStatus` disconnect path. `pointerup`/`pointerleave`/`pointercancel` were never wired through `stopActiveMovement()` — they already go through `handleMovementRelease()`, which was left untouched. `npm run build` and `npm test` (76/76) both pass after the change.
