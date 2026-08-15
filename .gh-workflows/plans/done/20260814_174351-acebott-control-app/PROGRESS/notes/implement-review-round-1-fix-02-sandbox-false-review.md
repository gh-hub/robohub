# Implement notes — review/round-1 fix 02 — sandbox: false review

## What was fixed

Review round 1 finding 2 (security): `main.ts`'s `BrowserWindow` set `sandbox: false` in
`webPreferences`, an undiscussed deviation weakening the isolation guarantee ADR-002 claims. Root
cause: Electron's default sandboxed preload environment cannot resolve local relative
`require()`s, and `preload.ts` had a runtime (value) import from `./ipcChannels.ts` for three
string constants.

**Path (a) taken — preferred path, succeeded on first attempt.** No fallback to path (b) was
needed.

Exact changes:

- **`app/src/preload.ts`** — removed `import { CAR_CONNECT_CHANNEL, CAR_DISCONNECT_CHANNEL,
  CAR_STATUS_CHANNEL } from "./ipcChannels.ts"` and replaced it with three local `const`
  declarations holding the same literal strings (`"car:connect"`, `"car:disconnect"`,
  `"car:status"`). The existing `import type { ConnectionState } from "./carConnection.ts"` was
  left in place — `import type` is erased entirely at compile time (TypeScript never emits a
  runtime `require()` for it), so it does not trip the sandboxed preload loader; this was verified
  empirically (build + the probe below), not just assumed. Added a header comment explaining the
  self-contained-preload constraint and that the inlined constants must be kept in sync by hand
  with `ipcChannels.ts` if it ever changes (small enough surface — 3 literals — that this is a
  reasonable trade-off per general.md's "no over-engineering").
- **`app/src/main.ts`** — removed the `sandbox: false,` line from `webPreferences`, restoring
  Electron's default (sandbox enabled). Rewrote the surrounding comment to explain why the default
  sandbox now works (preload.ts is self-contained) and to flag that reintroducing a local
  import/require in `preload.ts` would require re-verifying this, not blindly re-adding
  `sandbox: false`.

No changes to `ipcChannels.ts` itself — it's still the shared source of truth for `main.ts` and
`carIpcHandlers.ts`; only `preload.ts` stopped importing it.

## How it was verified

1. `npm run build` (both `tsconfig.build.json` and `tsconfig.renderer.json` passes) — clean, no
   errors.
2. `npm test` — 27/27 green (unchanged test count; this ticket touched no test files, since
   `preload.ts` has no dedicated unit tests — its correctness is verified via real-Electron probes,
   consistent with ticket 03's approach).
3. `npm start` launched twice (once mid-session, once as a final check) — process appears cleanly
   in `ps aux`, no errors in stdout/stderr, killed cleanly both times. No preload-related console
   warnings in the terminal output.
4. **Throwaway `executeJavaScript` probe** (written to the scratchpad, deleted immediately after
   use — never committed): a small standalone Electron main script that creates a hidden
   `BrowserWindow` pointed at the real `app/dist/preload.js` and `app/public/index.html`, with
   `contextIsolation: true` and `sandbox` **left unset** (i.e. Electron's default, `true` — the
   opposite of what the code had before this fix). It registered a `preload-error` listener (none
   fired) and used `executeJavaScript` to assert `typeof window.carAPI === "object"` and that
   `connect`/`disconnect`/`onStatus` are all functions, plus that `onStatus(...)`'s returned
   unsubscribe function is itself callable. Result: `{"exists":true,"connectIsFn":true,
   "disconnectIsFn":true,"onStatusIsFn":true,"unsubIsFn":true}`, `PRELOAD_ERRORED false`. The only
   console message captured was Electron's routine unpackaged-app "Insecure Content-Security-Policy"
   warning — a pre-existing non-finding already noted in round-1's security section, unrelated to
   preload/sandbox. Never called `.connect()`/`.disconnect()` (would target the hardcoded
   production `CAR_IP` — forbidden per the plan's rules). No network activity, no Wi-Fi joining.
5. Confirmed no stray Electron processes were left running after each verification pass (`ps aux`
   check before finishing).

## Gotchas / notes for next session

- **`import type` vs. a value import is the entire fix.** The preload sandboxing bug (originally
  found and worked around in ticket 03 — see `implement-03-ipc-bridge-preload.md` gotcha 2) was
  never about *any* import from another local file; it was specifically about a **value** import
  that survives to become a runtime `require()` in the compiled CommonJS output. `preload.ts`'s
  `import type { ConnectionState } from "./carConnection.ts"` was always type-only and therefore
  always safe — it was `ipcChannels.ts`'s value import (three string constants used at runtime)
  that broke the sandboxed preload loader. This distinction wasn't spelled out in ticket 03's notes
  or gotcha 7 of `CONTEXT.md`, so if `preload.ts` ever needs a new *value* (not type) import from
  another `app/src/` file, `sandbox: false` (or bundling) would become necessary again — inlining
  won't scale past small string/number constants.
- **Ticket file's own three checkboxes don't map 1:1 onto "removed" vs "kept" outcomes** — the
  third checkbox ("if kept, comment expanded") was marked `[x]` as N/A with an explanation, since
  path (a) succeeded and there was no kept `sandbox: false` to justify. This felt truer to the
  ticket's intent than leaving it unchecked or deleting it.
- **Both round-1 fix tickets are now done.** `implement/round-1-fix-01-http80-drop-detection` and
  `implement/round-1-fix-02-sandbox-false-review` are both `done` in `PROGRESS/INDEX.md`.
  `review/round-2` is next — a fresh review pass re-checking spec-match, security, and the
  automated-checks gate now that both round-1 findings have been addressed.
- No hardware verification was needed or attempted for this ticket — it's a pure
  Electron-configuration/build-time change, orthogonal to the still-deferred TCP:100-vs-HTTP:80
  live-car verification (see `CONTEXT.md` gotcha 1, still open, still deferred to the user).
