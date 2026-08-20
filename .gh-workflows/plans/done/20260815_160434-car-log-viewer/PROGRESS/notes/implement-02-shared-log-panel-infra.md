# Implement notes: 02 — Shared log-panel infrastructure

## What was built

Two new pure modules plus DOM wiring for two empty log panels, per the
ticket's acceptance criteria. No IPC, no live data source — that's tickets
03 (Wi-Fi) and 04 (USB), which plug into the seams built here.

1. **`app/src/logLineBuffer.ts`** (new, main-process side — plain CommonJS
   like `commandFrame.ts`/`carConnection.ts`, no Electron import):
   - `formatLogTimestamp(date: Date): string` — pure, renders
     `[HH:MM:SS.mmm]` (matches spec.md user story 16's example exactly).
   - `class LogLineBuffer` — `push(chunk: Buffer | string): string[]`.
     Buffers partial data across calls, splits complete lines on `\n`,
     strips a trailing `\r` (CRLF `Serial.println()`-style output), and
     prefixes each completed line with one receipt timestamp per `push()`
     call (not per line — every line completed by the same chunk shares one
     receipt time; this is a small simplification, noted below). Constructor
     takes an injectable `now: () => Date` for deterministic tests
     (defaults to `() => new Date()`).
   - Not wired into `carConnection.ts` or any new USB-serial module yet —
     ticket 03/04's job. This ticket only builds and unit-tests the shared
     buffer itself, per the ticket's own scope.
   - 12 unit tests in `app/src/logLineBuffer.test.ts` — timestamp
     formatting, no-newline buffering, multi-line chunks, CRLF stripping,
     partial-line-spanning-two-pushes, empty lines, `Buffer` input, empty
     chunk, and a default-clock smoke test.

2. **`app/src/logPanel.ts`** (new, renderer-side ESM — added to
   `tsconfig.renderer.json`'s `include` and `tsconfig.build.json`'s
   `exclude`, mirroring how `connectionUiState.ts` is already split out):
   - `MAX_LOG_PANEL_LINES = 500` (spec.md's cap).
   - `appendLogLines(existing, newLines, maxLines = 500): string[]` — pure,
     non-mutating, caps by dropping from the front once the combined total
     exceeds `maxLines`. 10 unit tests in `app/src/logPanel.test.ts`.
   - `clearLogLines(): string[]` — trivial (`[]`), given its own name so
     both panels' Clear buttons call one obvious, documented seam.
   - `renderLogPanel(panelElement, lines): void` — thin DOM-wiring: sets
     `textContent` to the joined lines, auto-scrolls to bottom **only when
     `lines.length > 0`** (this ticket's "no auto-scroll on empty panel" AC
     is an explicit guard, not incidental `scrollTop=0` behavior). Per
     spec.md's Testing Decisions, this DOM-touching function is
     **deliberately not unit-tested** — only the pure `appendLogLines`/
     `clearLogLines` array core is. See "Coding-rule conflict" below.

3. **`app/public/index.html`** — added a `#log-panels` flex row below the
   existing `#shoot-controls`, with two `.log-panel-container` blocks
   (`Wi-Fi Log` / `USB Log`), each holding a scrollable monospace
   `.log-panel` div (`#wifi-log-panel` / `#usb-log-panel`, `aria-live`
   polite) and its own Clear button (`#wifi-log-clear-button` /
   `#usb-log-clear-button`). Side-by-side layout matches grill/decisions.md's
   "Log panel UI" decision. No USB Log Connect/Disconnect button yet — that's
   ticket 04's job, deliberately not pre-built here to avoid getting ahead of
   its own ticket.

4. **`app/src/renderer.ts`** — imports `clearLogLines`/`renderLogPanel` from
   `logPanel.ts` (not `appendLogLines` — nothing calls it yet, so importing
   it now would just be a dead import; tickets 03/04 add it when they wire
   `onWifiLog`/`onUsbLog` IPC subscriptions). Added `wifiLogLines`/
   `usbLogLines` local state (deliberately **not** reset by the `onStatus`/
   `onUsbStatus` handlers — spec.md user story 14 requires logs to survive
   disconnect/reconnect), `renderWifiLog()`/`renderUsbLog()`,
   `handleWifiLogClear()`/`handleUsbLogClear()`. Initial render + Clear
   button listeners wired at the bottom of the file, same pattern as every
   other control.

5. **`app/tsconfig.renderer.json`** / **`app/tsconfig.build.json`** — added
   `logPanel.ts` to the renderer-only ESM include list / main-process
   CommonJS exclude list, exactly mirroring the existing
   `connectionUiState.ts`/`renderer.ts` split (see `connectionUiState.ts`'s
   top comment for why this split exists — pulling a renderer-ESM file into
   the CommonJS build clobbers `dist/*.js`).

## Verification performed

- `npm test` — all 177 tests pass (12 new in `logLineBuffer.test.ts`, 10 new
  in `logPanel.test.ts`, all pre-existing tests still green).
- `npx tsc --noEmit`, `npx tsc --project tsconfig.build.json --noEmit`,
  `npx tsc --project tsconfig.renderer.json --noEmit` — all three clean.
- Compiled the app (`tsc --project tsconfig.build.json && tsc --project
  tsconfig.renderer.json`, skipping the `rebuild-native` step — same
  reasoning as ticket 01's notes: no native toolchain in this sandbox, and
  `serialport`'s N-API prebuilt binding already resolves fine) and briefly
  launched the real Electron app (`npx electron .`, ~8s, then killed). No
  uncaught JS errors from `main.js`/`preload.js`/`renderer.js` — only
  Windows-sandbox-specific GPU/disk-cache warnings unrelated to this code.
  **This did not produce a visual screenshot** (no Playwright/Electron
  driver infra exists in this project, and this sandbox has no interactive
  display session to screenshot against) — so the panels' actual visual
  appearance (layout, empty-state styling) is confirmed by code review only,
  not a screenshot. A follow-up on a real dev machine should eyeball it.

## Coding-rule conflict (noted per implement.md step 5)

`coding-rules/general.md`'s "UI verification" rule says: "Verify UI/frontend
changes with Playwright ... If Playwright isn't set up yet in a web app
ticket, set it up as part of that ticket rather than falling back to
claude-in-chrome." This ticket touches renderer/DOM code but:

- spec.md's own "Testing Decisions" section explicitly scopes the renderer
  log-panel work to "pure logic tested, DOM-wiring left to manual testing,"
  matching the existing precedent for every other renderer control in this
  app (`connectionUiState.ts`'s mappers are unit-tested; `renderer.ts`'s
  `render()`/`renderLights()`/etc. DOM-wiring functions are not, across
  every prior ticket in this app's history).
- No Playwright (or any Electron-driver) infrastructure exists anywhere in
  this project despite several prior UI-touching tickets, and this is not a
  browser web app — it's an Electron desktop app, where `claude-in-chrome`
  (the rule's stated fallback) doesn't apply at all.
- Standing up Electron+Playwright test infra from scratch is a
  disproportionate scope expansion for an infra-only ticket whose own spec
  explicitly calls for manual verification of exactly this layer.

Resolution: followed spec.md's explicit, ticket-scoped testing decision
(pure-logic-only automated tests) over the general coding-rule, and did a
real (non-screenshotted) Electron launch as a lightweight substitute
sanity check. Flagging here rather than silently deviating, per implement.md
step 5. If a future ticket wants Playwright+Electron infra, it should be its
own scoped piece of work, not bolted onto this one.

## Gotchas for next session (ticket 03 — Wi-Fi Log panel)

- `LogLineBuffer` from `logLineBuffer.ts` is ready to be instantiated by
  whatever new code makes `carConnection.ts` emit received tcp100 socket
  bytes as a new additive event (per spec.md's "Implementation Decisions").
  Feed raw socket data into `push()`; each returned string is already
  timestamp-prefixed and ready to hand to the renderer via IPC.
- `appendLogLines`/`clearLogLines`/`renderLogPanel` from `logPanel.ts` are
  ready for `renderer.ts` to call once a `wifiLogLines`-updating IPC
  subscription (`onWifiLog`, following the `onUsbStatus` pattern in
  `preload.ts`) exists. `wifiLogLines`/`renderWifiLog()`/
  `handleWifiLogClear()` already exist in `renderer.ts` — ticket 03 should
  reuse them, not duplicate.
- Remember: per spec.md, `appendLogLines` needs to actually get imported in
  `renderer.ts` once ticket 03 wires live data in (it's currently unused
  there on purpose — see note above).
- The `#wifi-log-panel` DOM element already exists in `index.html`; no HTML
  changes should be needed for ticket 03 beyond possibly adding
  connect-state-dependent styling if desired (not required by spec.md).
- Still true from ticket 01's notes: `npm run build`'s `rebuild-native` step
  can't run in this sandbox; `serialport`'s prebuilt N-API binding works
  fine without it here. No CH340 hardware available for manual verification
  of anything hardware-dependent (not relevant to ticket 03's Wi-Fi path,
  but stays relevant for ticket 04).
- New gotcha from this session: this sandbox has no interactive display to
  screenshot an Electron window against, and the project has no
  Playwright/Electron driver infra — GUI/visual verification for any ticket
  in this plan needs a real dev machine, not just "run the app headlessly."
