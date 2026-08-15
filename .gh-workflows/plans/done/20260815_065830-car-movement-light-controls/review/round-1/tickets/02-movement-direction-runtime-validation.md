# 02 — [security] Validate movement direction string at the IPC trust boundary before use

**What to build:** Add explicit runtime validation of the `direction` parameter received over the `car:set-movement` IPC channel, before it is used to look up `MOVEMENT_VALUES[direction]` or reach `CarConnection.setMovement()`. Currently `direction: MovementDirection` is only a compile-time TypeScript annotation with no runtime check — an arbitrary string/object/null from the renderer would flow through with `MOVEMENT_VALUES[direction]` silently resolving to `undefined` (coerced to byte `0`, i.e. behaves like "stop") instead of being rejected. Add an explicit allowlist check (e.g. `direction in MOVEMENT_VALUES`, or a `switch`/`Set`-based check) that throws or rejects the IPC call for any value not in the seven allowed direction strings (`"stop" | "forward" | "backward" | "left" | "right" | "rotate-left" | "rotate-right"`). This should live at the IPC trust boundary — either in `carIpcHandlers.ts`'s `handleSetMovement`, or in `main.ts`'s IPC handler registration, whichever matches the codebase's existing validation conventions most closely (check how other IPC handlers, if any, validate input — otherwise place it in `handleSetMovement` since that's the layer already tested via `FakeCarConnection`). Add unit test coverage for the rejection behavior on invalid direction strings.

**Blocked by:** None — can start immediately (independent of ticket 01)

**Status:** done

- [x] handleSetMovement (or the IPC handler) rejects/throws for any direction string not in the seven allowed values, without reaching CarConnection.setMovement or the TCP socket
- [x] Valid direction strings still call through to CarConnection.setMovement exactly as before (no behavior change for legitimate input)
- [x] Unit test added covering rejection of at least one invalid/malformed direction string
- [x] Full test suite and build still pass after the change
