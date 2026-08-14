# 01 — Scaffold the Electron + TypeScript app skeleton

**What to build:** An Electron window launcher with a blank placeholder page, minimal build/dev infrastructure, and security defaults configured (contextIsolation on, nodeIntegration off), so every subsequent ticket can build and test the app.

**Blocked by:** None — can start immediately

**Status:** ready

- [x] `app/package.json` and `app/tsconfig.json` exist with working build/dev scripts
- [x] `npm start` launches an Electron window showing a placeholder page
- [x] Preload script is wired with `contextIsolation: true`, `nodeIntegration: false`
- [x] No car-connection logic present yet
