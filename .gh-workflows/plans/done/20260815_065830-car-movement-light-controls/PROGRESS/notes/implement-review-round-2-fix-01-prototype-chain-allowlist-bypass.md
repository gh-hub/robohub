# Implement: review round-2 fix 01 — prototype-chain allowlist bypass

## What was fixed

`app/src/carIpcHandlers.ts`'s `isMovementDirection()` type guard used
`value in MOVEMENT_VALUES`, which walks the prototype chain. Since
`MOVEMENT_VALUES` is a plain object literal, this returned `true` for
inherited `Object.prototype` property names — `"constructor"`, `"toString"`,
`"hasOwnProperty"`, `"valueOf"`, `"__proto__"`, `"isPrototypeOf"`,
`"propertyIsEnumerable"`, `"toLocaleString"` — none of which are valid
movement directions. Passing one of these through `car:set-movement` would
have made `isMovementDirection` return `true`, then
`MOVEMENT_VALUES["constructor"]` (etc.) would resolve to an inherited
function/object rather than a byte value, which `buildCommandFrame` in
`commandFrame.ts` silently coerces to byte `0` when writing into the
command-frame buffer — i.e. the exact same string-silently-resolves-to-stop
bug class the round-1 fix (ticket 02) was supposed to close, just narrowed to
these 8 trigger strings.

Fix: one-line change in `isMovementDirection()`, replacing the `in` operator
with an own-property check:

```ts
function isMovementDirection(value: unknown): value is MovementDirection {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(MOVEMENT_VALUES, value);
}
```

## TDD process

1. Added 8 new tests to `app/src/carIpcHandlers.test.ts`, one per inherited
   `Object.prototype` property name, each asserting `handleSetMovement`
   rejects with `/Invalid movement direction/` and that
   `connection.setMovementCalls` stays empty (mirroring the existing
   invalid-string/empty-string test pattern).
2. Ran the suite against the pre-fix `in`-based check: confirmed all 8 new
   tests failed (`not ok`), 78 pre-existing tests still passed — isolates the
   bug precisely to these 8 inputs, no other regressions.
3. Applied the one-line fix.
4. Re-ran: all 86 tests pass (78 pre-existing + 8 new).

## Verification run

- `npm run typecheck` — clean.
- `npx tsx --test src/carIpcHandlers.test.ts` — 28/28 pass (file-scoped run).
- `npm test` (full suite) — 86/86 pass.
- `npm run build` — clean (`tsc --project tsconfig.build.json && tsc --project tsconfig.renderer.json`).

## What review round-3 should re-check

- Confirm `isMovementDirection()` in `app/src/carIpcHandlers.ts` uses
  `Object.prototype.hasOwnProperty.call(MOVEMENT_VALUES, value)` (own-property
  check), not `in`.
- Confirm no other allowlist/membership check in the codebase uses the `in`
  operator against a plain-object literal in a similarly security-relevant
  position (this was the only occurrence found; `handleSetLights` takes a
  plain `boolean` so has no equivalent risk).
- This was purely a validation-logic fix at the IPC trust boundary — no
  behavior change for any of the 7 valid `MovementDirection` strings, no
  change to `CarConnection`, `commandFrame.ts`, or any renderer/UI code.
  Round-3 should be a narrow, fast confirmation rather than a full re-review,
  though a full spec re-check is still reasonable given round-2 already did
  one and found nothing else outstanding.
- The plan's one remaining non-review item is unchanged and unaffected by
  this fix: real-hardware manual verification of the D-pad press-and-hold
  interrupt semantics (ticket 03) is still OUTSTANDING and must be done by
  the user before merge — see
  `PROGRESS/notes/implement-03-movement-dpad-ui.md`'s checklist.
