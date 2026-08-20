# Implement notes: 04 — USB Log panel — connect/stream/disconnect end-to-end

This is the last ticket in the plan. All four tickets are now implemented;
review/round-1 is next.

## What was built this session

- **`app/src/ch340Port.ts`** (new): extracted `isCh340Port`/`SerialPortIdentity`
  out of `usbStatus.ts` (where ticket 01 left them, deliberately not yet
  shared, per its own notes) now that a second consumer genuinely needs them.
  Adds `findCh340PortPath(listPorts?)`, which lists ports and returns the
  first CH340-matching port's `path`, or `null` if none is found — the
  "shared VID/PID auto-detect helper" spec.md calls for. `SerialPortIdentity`
  gained a required `path: string` field (matching `serialport`'s own
  `PortInfo.path`, its one guaranteed-present field) since `findCh340PortPath`
  needs it; `isCh340Port` itself is unchanged.
- **`app/src/usbStatus.ts`**: now imports `isCh340Port`/`SerialPortIdentity`
  from `ch340Port.ts` and re-exports them (so nothing outside this module had
  to change its imports). `isUsbSerialDevicePresent`/`startUsbStatusPolling`
  are otherwise untouched.
- **`app/src/usbSerialConnection.ts`** (new): `UsbSerialConnection`, the
  USB-serial counterpart to `carConnection.ts`'s `CarConnection`. Framework-
  free, injectable (`openSerialPort`/`findPortPath` constructor options),
  `connect()`/`disconnect()`/`getState()`, emits `"log-line"` via a fresh
  `LogLineBuffer` per successful open (reusing the exact same module the
  Wi-Fi path uses, not a second copy). Fixed 115200 baud (not configurable,
  per spec.md's Out of Scope).
  - **One deliberate deviation from `CarConnection`'s contract**, called out
    in the class's own doc comment: `CarConnection.connect()` always
    resolves (even for an unreachable car) because `forwardConnectionStatus`
    is the renderer's real source of truth. This ticket's spec.md only lists
    three new IPC channels for USB Log (connect action, disconnect action,
    log-line push) — no connection-status push channel — so
    `UsbSerialConnection.connect()` *rejects* when no CH340 adapter is found
    or the port fails to open, since the promise's own
    resolution/rejection is the only signal the renderer has. Flagging this
    explicitly since it's a real behavioral difference from the sibling
    class, not an oversight.
  - `disconnect()` awaits the port's own `"close"` event (fired by both a
    user-initiated close and an unplug) rather than a separate callback, so
    there's a single source of truth (`handlePortClose`) for the state
    transition either way — no risk of a duplicate/conflicting update
    between the two paths.
- **`app/src/usbLogIpcHandlers.ts`** (new): `createUsbLogIpcHandlers`
  (`handleUsbLogConnect`/`handleUsbLogDisconnect`) and `forwardUsbLogLines`,
  mirroring `carIpcHandlers.ts`'s `createCarIpcHandlers`/
  `forwardConnectionStatus`/`forwardWifiLogLines` shapes exactly. Kept in its
  own file rather than folded into `carIpcHandlers.ts` since
  `UsbSerialConnection` is a wholly separate connection object/transport from
  `CarConnection` — no shared lifecycle to justify cramming them into one
  file.
- **`app/src/ipcChannels.ts`**: three new channel constants —
  `CAR_USB_LOG_CONNECT_CHANNEL` (`car:usb-log-connect`),
  `CAR_USB_LOG_DISCONNECT_CHANNEL` (`car:usb-log-disconnect`),
  `CAR_USB_LOG_LINE_CHANNEL` (`car:usb-log-line`).
- **`app/src/main.ts`**: instantiates `usbSerialConnection = new
  UsbSerialConnection()` (app-lifetime, separate from `carConnection`),
  wires `ipcMain.handle` for the two new action channels, wires
  `forwardUsbLogLines` in `createWindow()` with the same
  unsubscribe-on-`closed` discipline as the other forwarders, and adds
  `app.on("before-quit", ...)` to close the port if still connected when the
  app quits (the "closing the app closes the port" acceptance criterion).
- **`app/src/preload.ts`**: hand-duplicated the three new channel constants
  (per the file's "no local imports" constraint) and added
  `usbLogConnect`/`usbLogDisconnect`/`onUsbLogLine` to `CarApi` and the real
  `carAPI` object, following the exact `connect`/`disconnect`/`onWifiLogLine`
  patterns.
- **`app/src/renderer.ts`**: added `usbLogConnected` local state (no
  connection-status push channel exists for this — see above — so this is
  set directly from the resolution/rejection of `usbLogConnect()`/
  `usbLogDisconnect()`, not a pushed value), `renderUsbLogControls()`
  (flips the new toggle button's label), `handleUsbLogToggleClick()` (single
  toggle button, mirrors `handleToggleClick()`'s shape — see gotcha below
  about its error-recovery branch), and `onUsbLogLine` wiring
  (`appendLogLines`/`renderUsbLog()`, identical shape to `onWifiLogLine`).
- **`app/public/index.html`**: added `#usb-log-toggle-button` ("Connect"/
  "Disconnect") next to the existing USB Log panel's Clear button, plus
  matching CSS.

## Tests added

- `app/src/ch340Port.test.ts` (new — moved `isCh340Port` tests out of
  `usbStatus.test.ts` into this file, their new home; added
  `findCh340PortPath` tests: matching/non-matching/empty list, first-match-
  wins when multiple CH340 ports are listed).
- `app/src/usbStatus.test.ts`: removed the now-duplicated `isCh340Port`
  tests (kept `isUsbSerialDevicePresent`/`startUsbStatusPolling` tests
  unchanged); `fakePort()` now includes a `path` field to match
  `SerialPortIdentity`'s widened shape.
- `app/src/usbSerialConnection.test.ts` (new, 14 tests): a `FakeSerialPort`
  (plain `EventEmitter` implementing `SerialPortLike`, auto-fires `"open"` on
  the next microtask or `"error"` if configured to fail) stands in for the
  real `serialport`-backed port — no real hardware or native binding
  touched. Covers: opens at 115200 baud with the found path;
  connect() rejects (without opening) when no CH340 adapter is found;
  connect() rejects when open fails; sync-reject for
  already-connecting/already-connected; disconnect() sync-rejects when not
  connected; disconnect() closes the port and transitions to disconnected;
  multiple connect/disconnect cycles; log-line emission (multi-line chunk,
  trailing partial line discarded, no carried-over partial state across a
  reconnect); unplug-mid-stream (`"close"` with an error) transitions to
  `"error"` and a later `connect()` still succeeds; a bare `"error"` event
  doesn't crash the process.
- `app/src/usbLogIpcHandlers.test.ts` (new, 6 tests): mirrors
  `carIpcHandlers.test.ts`'s `FakeCarConnection` pattern with a
  `FakeUsbSerialConnection` — handler-calls-through-to-connection and
  rejection-propagation for connect/disconnect, plus
  `forwardUsbLogLines`/its unsubscribe.

All 206 tests pass (`npm test`, Node's built-in `node --test` runner — not
vitest; was 182 before this ticket). `npm run typecheck` is clean, and so
are `npx tsc --project tsconfig.build.json --noEmit` and `npx tsc --project
tsconfig.renderer.json --noEmit` run separately. Also compiled the app for
real (`tsc --project tsconfig.build.json && tsc --project
tsconfig.renderer.json`, skipping `rebuild-native` — same reasoning as every
prior ticket's notes: no native toolchain in this sandbox, and
`serialport`'s N-API prebuilt binding already resolves fine) and did a brief
headless `npx electron .` launch (~10s): no uncaught JS errors from
`main.js`/`preload.js`/`renderer.js`, only the same expected sandbox-only
GPU/disk-cache noise seen in every prior ticket's launch check.

## What's NOT verified (needs a real dev machine)

- **Live hardware end-to-end**: opening a real CH340 port, reading real
  bytes at 115200 baud, closing it cleanly, and confirming the OS actually
  releases the port afterward (so another tool like Arduino IDE/esptool.py
  can immediately reuse it) — no CH340 hardware in this sandbox, consistent
  with every prior ticket's gap in this plan. The fake-serial-port tests
  exercise the identical `UsbSerialConnection` code path a real `SerialPort`
  would, so this is a high-confidence gap, not an unknown.
- **`app.on("before-quit", ...)`'s actual port release on app close** —
  logically correct and follows the same call path `disconnect()` already
  has unit coverage for, but the Electron app-quit lifecycle itself isn't
  exercised by any automated test (same category as the rest of `main.ts`'s
  wiring, which has never had direct tests in this project).
- **Visual/DOM verification** (button label flips, panel auto-scroll) — no
  display/Playwright/Electron-driver infra in this sandbox, same noted
  coding-rule conflict as tickets 02/03 (spec.md's own testing decisions
  scope this to manual verification; flagging again rather than re-deciding
  it).
- **The stale-button-label-after-unplug gap**: since there's no USB Log
  connection-status push channel (only connect/disconnect actions and
  log-line pushes are wired, matching the ticket's own literal channel
  list), if the device is unplugged mid-stream, `usbSerialConnection`
  internally transitions to `"error"` and stops emitting log lines, but the
  renderer's toggle button keeps showing "Disconnect" until the user clicks
  it — at which point `usbLogDisconnect()` rejects (module is no longer
  `"connected"`) and the renderer's catch block resets `usbLogConnected` to
  `false` anyway, self-correcting the button. This is a real, intentional
  tradeoff (not silently done) given the ticket's own channel list didn't
  include a status-push channel; a future ticket could add one
  (`onUsbLogStatus`, mirroring `onStatus`/`onUsbStatus`) if this UX gap
  turns out to matter in practice.

## Gotchas for the next session (review phase)

- `usbSerialConnection.ts`'s `connect()` **rejects** on failure (no adapter
  found / open failed), unlike `carConnection.ts`'s `CarConnection.connect()`
  which **always resolves**. This is intentional and documented in the
  class's own doc comment (see "What was built" above) — worth double-
  checking during review that this doesn't read as an inconsistency bug.
- `SerialPortLike` (the injectable interface in `usbSerialConnection.ts`) is
  structurally satisfied by the real `serialport` `SerialPort` class without
  any adapter/wrapper code — confirmed by `npx tsc --noEmit` compiling
  cleanly with `openRealSerialPort()`'s `new SerialPort(...)` return
  directly typed as `SerialPortLike`. Worth a sanity check in review if this
  ever seems surprising; it's due to `@types/node`'s stream typings already
  including compatible overloads for `"data"`/`"close"`/`"error"` plus a
  generic string-event fallback for `"open"`.
- `ch340Port.ts` is now the single home for `isCh340Port`/
  `findCh340PortPath`; `usbStatus.ts` re-exports both for backward
  compatibility with existing importers rather than requiring every call
  site to be updated. Confirm during review this re-export doesn't feel like
  needless indirection versus just updating the (small number of) import
  sites directly.
- All of this plan's now-familiar sandbox gaps still apply unchanged:
  `npm run build`'s `rebuild-native` step (no native toolchain here), no
  CH340 hardware, no interactive display/Playwright infra. None of these are
  ticket-04-specific; they're carried forward from every prior ticket's
  notes and `CONTEXT.md`'s Gotchas section.

## Next session should load

- `CONTEXT.md` (updated this session — all four tickets now done)
- `spec.md` — particularly "Testing Decisions" and the USB-serial-module
  bullets in "Implementation Decisions", to check the review phase's
  findings against what was actually agreed upon.
- This notes file, plus [ticket 04](../../tickets/04-usb-log-panel.md) itself
  (now fully checked off, with inline notes on the two known gaps above).
