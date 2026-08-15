# Review round 1 findings

## Spec match

**(a) Missing/partial:** None found — every requirement (single Lights button, six D-pad buttons, `DEVICE_MOTOR`/`MOVEMENT_VALUES` table, `setMovement()`, `car:set-movement` IPC channel, `mapMovementControlUiState`, and all four listed unit-test suites) is present and matches the spec's file-by-file implementation decisions.

**(b) Scope creep:** None found — the diff stays within the touched files the spec names (`index.html`, `renderer.ts`, `commandFrame.ts`, `carConnection.ts`, `ipcChannels.ts`, `carIpcHandlers.ts`, `preload.ts`, `connectionUiState.ts`, `main.ts`, and their tests). No renderer pointer-wiring tests were added, correctly honoring "Explicitly NOT unit tested: pointer event wiring... verified manually."

**(c) Implemented but wrong:**

`renderer.ts`'s `onStatus` handler calls `stopActiveMovement()` when the connection leaves `connected`+`tcp100`, and that function unconditionally calls `sendMovement("stop")` (which invokes `window.carAPI.setMovement("stop")` over IPC). This contradicts the spec:

> "Also clear `activeDirection` (without attempting to send, since the socket is already gone or about to be) whenever the connection status transitions away from `connected`+`tcp100` in the existing `onStatus` handler — this is a local state reset, not a new Stop-sending path, since `CarConnection.setMovement()` already rejects synchronously once the session is no longer live."

The spec explicitly calls for a **local-only reset** on connection-drop (no send attempt), but the implementation reuses the same send-based helper for both `window.blur` (which *should* send Stop) and the `onStatus` connection-drop path (which should *not*). The send will reject and be swallowed by `.catch(console.error)`, so it's not user-visible breakage, but it is a real deviation from the spec's stated design (an unnecessary IPC round-trip/rejection on every disconnect-while-holding instead of a pure state reset), and conflates two behaviorally distinct paths the spec deliberately separated.

Relevant lines: `app/src/renderer.ts` (`stopActiveMovement`, ~lines 743–749) and its use in the `onStatus` handler (~lines 780–783).

## Security

### Insufficient input validation — `car:set-movement` IPC channel accepts unvalidated direction strings

`app/src/main.ts`:
```ts
ipcMain.handle(CAR_SET_MOVEMENT_CHANNEL, (_event, direction: MovementDirection) =>
  carIpcHandlers.handleSetMovement(direction),
);
```
`app/src/commandFrame.ts`:
```ts
export function buildCommandFrame({ action, device, value }: CommandFrameFields): Buffer {
  const payload = Buffer.alloc(PAYLOAD_LENGTH, 0);
  ...
  payload[PAYLOAD_VALUE_INDEX] = value;
```

`direction: MovementDirection` is a compile-time-only annotation; nothing in `main.ts`, `carIpcHandlers.handleSetMovement`, or `CarConnection.setMovement` checks the value at runtime against the seven allowed strings before doing `MOVEMENT_VALUES[direction]`. Any renderer code that can call `window.carAPI.setMovement(...)` (e.g. via devtools, a compromised dependency, or future remote-content load) can pass an arbitrary string, object, or `null`.

Exploit scenario: a compromised/malicious renderer calls `window.carAPI.setMovement("<anything not in the allowlist>")`. `MOVEMENT_VALUES[direction]` returns `undefined`; writing `undefined` into the `Buffer` coerces to `0`, so today the practical effect is limited to silently sending a frame identical to `"stop"` rather than rejecting the call. That is the only reason this isn't a full write-arbitrary-byte primitive — there's no `NaN`-to-buffer overflow and no prototype-pollution write path (`MOVEMENT_VALUES.constructor`/`__proto__` are reads, not writes). But there is no allowlist check or rejection anywhere on this trust boundary, so the guarantee that only the six documented motor commands (plus stop) ever reach the TCP socket rests entirely on erased TypeScript types, not runtime enforcement — a gap that should be closed with an explicit `direction in MOVEMENT_VALUES` (or switch/allowlist) check that throws/rejects on anything else, matching how a real IPC trust boundary should validate input from the renderer.

Mitigating context confirmed in `main.ts`: `contextIsolation: true`, `nodeIntegration: false`, sandbox left at its default (`true`), and the window only ever loads a local `index.html` — no remote content is loaded, which meaningfully narrows the realistic attacker model for this finding.

No other findings (injection, auth/session, XSS, secrets, CORS/TLS, deserialization, crypto, path traversal, CSRF, or dependency issues) were introduced by this diff — the rest of the changes (light-button merge, D-pad UI, `DEVICE_MOTOR`/`MOVEMENT_VALUES` constants, tests) are static-string/state-mapping changes with no user-controlled data reaching a sink.

## Automated checks

- **Lint:** N/A — no lint tooling configured anywhere in this project (no eslint config, no `lint` npm script at root or in `app/`).
- **Build:** PASS — `npm run build` (`tsc --project tsconfig.build.json && tsc --project tsconfig.renderer.json`) completed cleanly, no errors.
- **Unit/integration tests:** PASS — `npm test` (`node --test src/**/*.test.ts`) in `app/`: 76/76 passing, 0 failures, no reruns needed (not flaky).
- **E2E tests:** N/A — no e2e suite configured (no `test:e2e`/`e2e`/cypress/playwright script in `app/package.json`).
