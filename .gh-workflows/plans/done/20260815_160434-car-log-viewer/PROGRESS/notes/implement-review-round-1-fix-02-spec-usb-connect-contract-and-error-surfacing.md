# Notes: implement/review-round-1-fix-02-spec-usb-connect-contract-and-error-surfacing

## What was built

Fixed review round 1's spec-match finding (c): `UsbSerialConnection.connect()`
diverged from spec.md's "resolves once initiated, rejects synchronously for
an invalid current state" contract (the same one `CarConnection.connect()`
already follows), and there was no operator-facing UI for a failed USB Log
Connect attempt (no CH340 detected, port open error) — only
`console.error(...)`.

1. **`app/src/usbSerialConnection.ts`** — `connect()` no longer `throw`s for
   "no CH340 adapter found" or "failed to open the port"; both branches now
   just `this.setState({ status: "error", message })` and return normally,
   so the promise always resolves once initiated. The synchronous
   "already connecting"/"already connected" `throw` at the top of the method
   is untouched — that's still the one legitimate rejection case, matching
   `CarConnection.connect()` exactly. Class doc comment rewritten to drop
   the "one deliberate difference from CarConnection" paragraph — it's no
   longer different.

2. **`app/src/ipcChannels.ts`** — new `CAR_USB_LOG_STATUS_CHANNEL =
   "car:usb-log-status"`.

3. **`app/src/usbLogIpcHandlers.ts`** — new `forwardUsbLogStatus()`, mirroring
   `forwardConnectionStatus()` in `carIpcHandlers.ts` exactly: subscribes to
   `UsbSerialConnection`'s existing `"state-change"` event (it already emitted
   this internally via `setState()` — nothing new needed on the emitter side)
   and returns an unsubscribe function. `UsbSerialConnectionLike` extended
   with `on`/`off` for `"state-change"`.

4. **`app/src/main.ts`** — wires `forwardUsbLogStatus(usbSerialConnection, ...)`
   to `window.webContents.send(CAR_USB_LOG_STATUS_CHANNEL, state)`, same
   unsubscribe-on-close discipline as the other three forwarders.

5. **`app/src/preload.ts`** — new `onUsbLogStatus` on `window.carAPI`,
   mirroring `onStatus` exactly (type-only import of `UsbSerialState` from
   `usbSerialConnection.ts`, safe per this file's own "zero local
   require()/import" constraint — mirrors the existing `ConnectionState`
   type-only import).

6. **`app/src/connectionUiState.ts`** — new `UsbLogStatus`/`UsbLogState`
   types (redeclared locally, same reasoning as `ConnectionState` at the top
   of this file — it compiles into the ESM renderer build and can't import
   from the CommonJS `usbSerialConnection.ts`) and a new pure
   `mapUsbLogControlUiState()` function, mirroring
   `mapConnectionStatusToUiState()`'s four-state switch (disconnected /
   connecting / connected / error) exactly, including the same "error state's
   button stays enabled so the user can retry" behavior.

7. **`app/src/renderer.ts`** — replaced the app-tracked `usbLogConnected`
   boolean (previously set only from the connect/disconnect promise's own
   resolution/rejection) with a real `usbLogState: UsbLogState` mirrored from
   the new `onUsbLogStatus` push, the same way `currentState` mirrors
   `onStatus`. `renderUsbLogControls()` now renders from
   `mapUsbLogControlUiState()` (button label/disabled + a new status text
   element) instead of a hand-rolled label flip.
   `handleUsbLogToggleClick()` simplified to match `handleToggleClick()`'s
   shape: the promise rejection is only logged (it's now only the
   invalid-current-state case), since the real signal is the status push.

8. **`app/public/index.html`** — new `#usb-log-status-text` span next to the
   USB Log toggle button, plus `.usb-log-status-{disconnected,connecting,
   connected,error}` CSS classes mirroring the existing
   `.status-*`/`.usb-status-*` color scheme (grey/amber/green/red).

## Side effect: also closes a previously-flagged UX gap

CONTEXT.md's gotchas noted the USB Log Connect/Disconnect button could show a
stale label after a mid-stream unplug, self-correcting only on the user's
next click — a known tradeoff from ticket 04, flagged for review to decide on.
Since `UsbSerialConnection` already emitted `"state-change"` for every state
transition including an unplug-triggered close (`handlePortClose`), and this
fix adds IPC forwarding for that exact event, the renderer's button/status
text now update live on an unplug too — no separate work was needed for this,
it fell out of wiring the status-push channel the ticket asked for.

## TDD process followed

1. Read `usbSerialConnection.test.ts`, `usbLogIpcHandlers.test.ts`,
   `carIpcHandlers.test.ts` (for the `forwardConnectionStatus` test pattern
   to mirror), and `connectionUiState.test.ts` first to understand existing
   conventions.
2. Changed `usbSerialConnection.ts`'s `connect()` contract, then updated its
   two now-wrong rejection tests to assert resolution + `status: "error"`
   instead, plus added one new test asserting the `"state-change"` sequence.
   Ran `node --test src/usbSerialConnection.test.ts` — all 15 pass.
3. Added `forwardUsbLogStatus()` to `usbLogIpcHandlers.ts`; updated
   `FakeUsbSerialConnection.setState()` in its test file to emit
   `"state-change"` (it didn't before — the fake only tracked state
   internally); added two new tests mirroring `forwardConnectionStatus`'s
   pair; fixed the one existing "rejects" test's simulated error message
   to represent an invalid-state rejection (the only kind still possible)
   rather than the now-inapplicable "no CH340 found" message. Ran
   `node --test src/usbLogIpcHandlers.test.ts` — all 8 pass.
4. Wired `main.ts`/`preload.ts`. Ran `npm run typecheck` — caught one
   expected error (renderer.ts's locally-redeclared `CarApi` interface
   no longer matching preload.ts's `CarApi` after adding `onUsbLogStatus`
   to the latter) before renderer.ts was updated, confirming the two files'
   redeclaration precedent actually gets type-checked.
5. Added `mapUsbLogControlUiState()` to `connectionUiState.ts` and its seven
   tests to `connectionUiState.test.ts` (mirroring
   `mapConnectionStatusToUiState`'s existing seven). Ran
   `node --test src/connectionUiState.test.ts` — all 42 pass (35 existing +
   7 new).
6. Updated `renderer.ts` and `index.html`'s DOM wiring last (this is the
   "thin DOM-wiring, manually tested" layer per spec.md's testing decision —
   no Playwright/browser-emulation test exists for it, matching ticket 02's
   own notes on this project's coding-rule-vs-spec.md precedent).
7. Ran `npm run typecheck` — clean. Ran `npx tsc --project
   tsconfig.build.json` and `npx tsc --project tsconfig.renderer.json`
   separately (the two halves of `npm run build`, minus the
   `rebuild-native` step this sandbox can't run) — both clean, `dist/`
   shows no CJS/ESM clobbering. Ran a brief headless `npx electron .`
   launch — no load-time JS errors from `main.js`/`preload.js`/
   `renderer.js` (only expected sandboxed GPU/network noise).
8. Ran full `npm test` — 218/218 pass (was 208 before this ticket; +10 net
   new tests: usbSerialConnection +1, usbLogIpcHandlers +2,
   connectionUiState +7).

## Ticket status

All 5 acceptance criteria in
`review/round-1/tickets/02-spec-usb-connect-contract-and-error-surfacing.md`
checked off `[x]` with evidence notes inline. Live-hardware verification
(the actual error text/UI on a real CH340 device) is still needed — noted
in the ticket itself, no CH340 hardware in this environment.

## What the next session (ticket 03) needs to know

- Ticket 03 is `review/round-1/tickets/03-spec-remove-unrequested-dev-script.md`
  — the scope-creep finding: `app/package.json` has `"dev": "npm run start"`,
  which spec.md never asked for (only a `rebuild-native` step wired into
  "the existing build/start scripts" was in scope). This should be a small,
  self-contained fix: remove that one line from `package.json`'s `scripts`,
  confirm nothing else references `npm run dev` (check README/CI/docs too),
  rerun `npm test`/`npm run typecheck` once at the end. No code/test changes
  expected beyond that single line, unless something else turns out to
  depend on it.
- No gotchas left behind by this ticket for ticket 03 — the USB Log
  connect/status-push work is self-contained to the files listed above and
  doesn't touch `package.json`.
- Reminder from ticket 02's own context (still true): this sandbox has no
  CH340 hardware, no Visual Studio Build Tools for `electron-rebuild`, and
  no interactive display/Playwright infra — all still apply unchanged for
  ticket 03, though ticket 03 shouldn't need any of them since it's a
  package.json-only change.
