# Review Round 1 — Findings

## Spec match

**Finding 1 — HTTP:80 sessions have no live drop detection**

`carConnection.ts`'s `probeTcpAndHold()` keeps the `net.Socket` open and wires `close`/`error` listeners for the tcp100 path, but the http80 path (`probeHttp()`) is a one-shot GET — no socket is retained (`this.socket` stays `null`). Once connected via http80, there is no listener of any kind watching for the car going away; the UI will keep showing "Connected" until the user manually clicks Disconnect. This contradicts:

- Solution: "the main process listens for the underlying TCP socket's `close`/`error` events (not polling) and automatically flips the UI to 'disconnected'... the moment the connection actually goes away — **the UI never keeps claiming 'Connected' after the car has gone offline**."
- User Story 6: "I want the app to automatically detect when my connection drops... **without me needing to notice on my own**, so the displayed status never lies about the real connection state."

The code's own comment acknowledges this ("an http80 session has no live drop detection... This is a firmware constraint, not a gap"), but the spec's requirement is stated unconditionally across both protocols, not scoped to tcp100 only.

**Finding 2 — `sandbox: false` on the BrowserWindow (main.ts, webPreferences) is an undiscussed architectural deviation**

Not mentioned anywhere in spec.md. While `contextIsolation: true` / `nodeIntegration: false` are correctly kept (satisfying the literal renderer-isolation requirement), disabling the sandbox weakens the security posture ADR-002 claims as a consequence: "Maintains Electron's process-isolation sandboxing. If the renderer is compromised, it cannot directly access system resources." This is an undiscussed architectural deviation introduced to work around preload module resolution (a local `require()` inside preload.ts), not something the spec asked for or flagged as acceptable.

No other gaps found — probe sequencing, state machine, IPC contract, UI mapping, and config constants all match spec.

## Security

No findings. Reviewed `app/src/main.ts`, `preload.ts`, `carConnection.ts`, `carIpcHandlers.ts`, `renderer.ts`, `ipcChannels.ts`, `carConfig.ts`, `index.html`, `package.json` against the standard vulnerability baseline (injection, broken auth/access control, sensitive data exposure, security misconfiguration, XSS, insecure deserialization, vulnerable dependencies, insufficient input validation, SSRF, path traversal, cryptographic issues, CSRF). No exploitable issues: the IPC surface takes zero renderer-controlled arguments (connect/disconnect are parameterless), all DOM writes use `.textContent` never `.innerHTML`, no secrets/auth/crypto logic exists in the app, and `loadFile()` only ever loads local bundled HTML (never remote/untrusted content via `loadURL`). One non-finding observation: `index.html` has no CSP meta tag, but there is no remote content or untrusted-input-to-innerHTML path for a missing CSP to actually mitigate here.

## Automated checks

| Check | Result |
|---|---|
| Lint | N/A — no lint script defined in `app/package.json` |
| Build (`npm run build`, includes typecheck via `tsc --project tsconfig.build.json` + `tsconfig.renderer.json`) | PASS |
| Typecheck (`npm run typecheck`) | PASS |
| Unit/integration tests (`npm test`) | PASS — 25/25 |
| E2E tests | N/A — no e2e suite exists in this project |
