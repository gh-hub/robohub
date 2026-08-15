# Implement notes — 01-scaffold-electron-app

## What was built

New `app/` subdirectory at repo root (repo had no root `package.json`, no root `.gitignore`, no monorepo tooling — `app/` is a standalone npm project with its own `.gitignore`):

- `app/package.json` — scripts: `build` (`tsc`), `start` (`npm run build && electron .`), `typecheck` (`tsc --noEmit`). devDependencies: `electron ^32.2.0` (resolved 32.3.3), `typescript ^5.7.0`, `@types/node ^22.10.0`.
- `app/tsconfig.json` — `target: ES2022`, `module: commonjs`, `strict: true`, `rootDir: src`, `outDir: dist`.
- `app/src/main.ts` — Electron main process. Creates one `BrowserWindow` (800x600), loads `../public/index.html` (relative to compiled `dist/main.js`, i.e. `app/public/index.html`). `webPreferences: { preload: dist/preload.js, contextIsolation: true, nodeIntegration: false }`. Standard `window-all-closed` / `activate` lifecycle handlers.
- `app/src/preload.ts` — minimal, exposes nothing yet (`export {}`). Comment notes that per ADR-002 the main process owns all privileged operations, and a future ticket will use `contextBridge.exposeInMainWorld` for a narrow, declared IPC surface.
- `app/public/index.html` — static placeholder page, no car-related UI, not run through `tsc` (kept outside `src/` so the TS build doesn't touch it).
- `app/.gitignore` — `node_modules/`, `dist/`.

## Key decision: TS execution strategy

Chose **compile-then-run** (`tsc` → `dist/*.js` → `electron .` with `main: dist/main.js`) over a ts-node/tsx dev loader. Reasoning:
- Keeps `npm start` and `tsc --noEmit` verifying the exact same compilation path (no separate loader config to drift from tsconfig).
- No extra runtime dependency (ts-node/tsx) needed for something this small.
- Electron's `main` field in `package.json` needs a plain `.js` entry point regardless; compiling up front is the most standard/robust setup and it's what most Electron+TS scaffolds do.
- Tradeoff: no hot-reload dev loop yet — `npm start` always rebuilds first, so it's slightly slower to iterate than a tsx watch setup. Not a problem for this ticket's scope; can be revisited later if iteration speed becomes annoying.

## Verification performed

- `npm install` in `app/` — succeeded, 72 packages. `npm audit` reports 2 high-severity advisories in electron 32.x / extract-zip (known upstream issues in that Electron minor line, e.g. context-isolation-bypass and devtools-related CVEs disclosed after 32.x's release). `npm audit fix --force` would bump to Electron 43 (breaking, out of scope for a scaffold ticket) — left as-is, flagging for awareness. Not a runtime concern yet since the app does nothing privileged.
- `npx tsc --noEmit` — clean, exit 0.
- `npm run build` — clean, produced `dist/main.js` and `dist/preload.js`.
- Launched `npx electron .` directly, then separately the full `npm start` — both times confirmed via `ps aux` that the Electron main process plus GPU/network/renderer helper processes came up and stayed up (no crash, empty stderr/stdout log) before being killed with `pkill`. Could not visually confirm the window renders (no display capture available), but process-level launch is verified clean both ways.

## Gotchas / notes for ticket 02

- Repo root has no `package.json`/`.gitignore`/workspace config — `app/` is fully self-contained. If a later ticket wants a root-level convenience (e.g. `npm run app:start` from repo root), that'd be a new decision, not something already in place.
- `dist/` is build output, gitignored — ticket 02 should keep building on `src/main.ts` (compiled main process) and add the TCP socket module there, not in `dist/`.
- Car's actual protocol (binary TCP:100 vs HTTP:80) is still unconfirmed — per CONTEXT.md gotchas, ticket 02 needs to probe this against real hardware, don't assume either one.
- Preload (`app/src/preload.ts`) currently exposes nothing — ticket 03 (IPC bridge + preload contract) is where `contextBridge.exposeInMainWorld` gets added, not ticket 02. Ticket 02 should keep the connection module free of any renderer/IPC wiring, per ADR-002 (main process owns the socket).
- `npm start` always runs a full `tsc` build first — fine for now, no watch mode configured.
