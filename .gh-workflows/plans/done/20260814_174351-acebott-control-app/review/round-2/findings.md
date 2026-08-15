# Review Round 2 — Findings

## Spec match

**Finding 1 — HTTP:80 liveness-poll failure always routes to "disconnected", never "error" — collapses the required clean/abrupt distinction (implemented but wrong)**

Spec (Solution): "the main process listens for the underlying TCP socket's `close`/`error` events... and automatically flips the UI to 'disconnected' (clean close) or 'error' (abrupt close)." User Story 9: "a clean disconnect... to be visually distinguishable from an abrupt/error disconnect."

For TCP, `handleSocketClose(hadError)` correctly branches (clean close → `disconnected`; abrupt/RST → `error`, verified by test at `carConnection.test.ts:332`). But `checkHttpLiveness()` in `app/src/carConnection.ts` (around lines 226-244) always calls `this.setState({ ...DISCONNECTED_STATE })` on a failed poll — regardless of *why* the poll failed. A car that's powered off or walked out of Wi-Fi range mid-http80-session (the scenario User Story 6 explicitly calls out) is indistinguishable from a clean shutdown: both show "Disconnected," never "error." The round-1 fix added drop detection for http80 but only reimplemented half of the required behavior — the same collapsing exists in the test suite too (a test titled "...goes to disconnected" for what is really an abrupt-disappearance scenario, asserting the same `DISCONNECTED_STATE` shape).

This was independently verified by reading `app/src/carConnection.ts` directly (lines 210-255): `checkHttpLiveness()` has no branch distinguishing a poll failure reason — every failure path (timeout, connection refused, DNS failure) sets the identical `DISCONNECTED_STATE`.

**Round-1 fixes re-verified — both hold:**

1. HTTP:80 liveness polling — genuinely implemented (interval GET, in-flight guard, cleared on disconnect), but with the defect above (doesn't distinguish clean vs. abrupt).
2. `sandbox: false` removal — genuinely fixed and confirmed clean. `main.ts` has no `sandbox` key at all (defaults to Electron's sandboxed preload). `preload.ts` only has a compile-time-erased `import type` plus inlined string constants — no runtime local `require()`/`import`.

No scope creep found; no other partial/missing requirements identified beyond the item above.

## Security

No findings. Re-verified the round-1 `sandbox: false` fix by reading `main.ts` and `preload.ts` directly (not just trusting the round-1 claim): `sandbox` is absent from `main.ts`'s `webPreferences` (Electron's default `sandbox: true` applies), and `preload.ts`'s only import beyond Electron's built-in module is a compile-time-erased `import type` — no runtime local imports remain. `contextBridge.exposeInMainWorld` still exposes only `connect`/`disconnect`/`onStatus`, no raw `ipcRenderer`, no Node APIs.

Checked the full flow against the standard vulnerability baseline (injection, broken auth/access control, sensitive data exposure, security misconfiguration, XSS, insecure deserialization, vulnerable dependencies, insufficient input validation, SSRF, path traversal, cryptographic issues, CSRF): `ipcMain.handle` handlers take zero renderer-controlled arguments; host/port/SSID come only from `carConfig.ts` constants, never renderer/network input (no SSRF vector despite raw `net`/`http` usage); all DOM writes use `.textContent`/`.className`, never `.innerHTML` (no XSS sink even for arbitrary error-message text); `index.html` is loaded only via `loadFile()` on a local path, no remote content; no deserialization, no crypto, no new dependencies beyond dev-only `electron`/`typescript`/`@types/node`. Hardcoded `CAR_IP`/`CAR_SSID`/ports are non-sensitive local network config by design, not credentials — correctly not flagged.

## Automated checks

| Check | Result |
|---|---|
| Lint | N/A — no lint script defined in `app/package.json` |
| Build (`npm run build`, includes typecheck via `tsc --project tsconfig.build.json` + `tsconfig.renderer.json`) | PASS |
| Typecheck (`npm run typecheck`) | PASS |
| Unit/integration tests (`npm test`) | PASS — 27/27 |
| E2E tests | N/A — no e2e suite exists in this project |
