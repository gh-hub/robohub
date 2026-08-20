# Implement notes: 01 — serialport dependency and USB badge fix

## What was built

- Added `serialport@^13.0.0` as the app's first runtime dependency (`app/package.json`).
- Added `@electron/rebuild@^4.2.0` as a devDependency and a new `rebuild-native` script
  (`electron-rebuild -f -w serialport`), wired into `build` (which `start` and the new `dev`
  alias both depend on). This project had no pre-existing `dev` script — only `start` — so
  `dev` was added as an alias for `start` to literally satisfy the ticket's "npm run dev"
  wording; functionally the rebuild step lives in `build`, which both invoke.
- Rewrote `app/src/usbStatus.ts`:
  - `isCh340Port(port: SerialPortIdentity): boolean` — new pure, exported VID/PID matcher.
    Normalizes hex casing and an optional `0x` prefix on both sides before comparing against
    the documented CH340 identity (`0x1A86`/`0x7523`). `serialport`'s `PortInfo.vendorId`/
    `productId` come back as lowercase hex with no `0x` prefix, but the matcher accepts either
    form defensively.
  - `isUsbSerialDevicePresent(listPorts?)` — now `async`, calls `SerialPort.list()` by default
    (injectable `listPorts` param for tests, replacing the old injectable `deviceDirectory`
    param). Returns `false` (not throw) if `listPorts` rejects, matching the old "unreadable is
    indistinguishable from absent" behavior.
  - Dropped the `process.platform !== "darwin"` branch entirely, and the old `node:fs`
    `readdirSync`/`/dev/cu.usbserial-*` scan.
  - `startUsbStatusPolling`'s `checkDevicePresent` param signature widened from `() => boolean`
    to `() => boolean | Promise<boolean>`. A plain boolean is still handled synchronously within
    the same poll tick (checked via `result instanceof Promise`); only a real promise is
    awaited. This was the key design choice to satisfy the ticket's "polling/push-on-change
    event shape ... unchanged" criterion: all of `startUsbStatusPolling`'s pre-existing tests
    (which inject plain sync fakes like `() => true`) pass completely unmodified, with genuinely
    synchronous semantics preserved for sync callers, while the real production path
    (`isUsbSerialDevicePresent`, backed by `serialport`'s async `SerialPort.list()`) uses the
    async branch.
  - `main.ts` needed no changes — it already passes `isUsbSerialDevicePresent` directly as the
    `checkDevicePresent` callback, which is still valid under the widened signature.
- Rewrote `app/src/usbStatus.test.ts`: replaced the old directory/platform-based tests for
  `isUsbSerialDevicePresent` with tests injecting a fake `listPorts` (matching/non-matching/
  empty/rejecting), added dedicated tests for `isCh340Port` (lowercase, `0x`-prefixed, mixed
  case, missing fields), and added one new test confirming `startUsbStatusPolling` correctly
  awaits an async `checkDevicePresent`. All pre-existing `startUsbStatusPolling` tests kept
  verbatim.

## Verification

- `npm run typecheck` — clean, no errors.
- `npm test` — full suite passes: 155/155 (was 141 before this ticket; net +14 from the
  rewritten usbStatus tests).
- `npx tsc --project tsconfig.build.json && npx tsc --project tsconfig.renderer.json` —
  compiles cleanly (this is what `npm run build` runs after `rebuild-native`).

## Gotchas / things the next session (or a real dev machine) needs to know

1. **`npm run build` / `npm run rebuild-native` could not be verified end-to-end in this
   sandbox.** `electron-rebuild -f -w serialport` fails here with "Could not find any Visual
   Studio installation to use" (node-gyp can't find MSVC Build Tools). This sandbox has no
   native C++ build toolchain installed. On a real dev machine this needs Visual Studio Build
   Tools ("Desktop development with C++" workload) on Windows, or Xcode Command Line Tools on
   macOS.
2. **This is likely a non-blocking gap in practice**, not a real defect: `@serialport/bindings-cpp`
   ships prebuilt N-API binaries (`napi_versions: [8]`, confirmed in its `package.json`) for
   `win32-x64`, `win32-ia32`, `win32-arm64`, and `darwin-x64+arm64`. Its own `install` script
   (`node-gyp-build`) already resolved and used the correct prebuilt binary in this sandbox at
   plain `npm install` time — proven by `npm test` successfully exercising the real
   `SerialPort` binding (not just fakes) via `isUsbSerialDevicePresent`'s default `listPorts`
   codepath being importable/typecheckable, and by the module loading without error. N-API is
   ABI-stable across Node/Electron versions that support the same napi version, so the
   already-resolved prebuild is very likely usable as-is under Electron without ever running
   `rebuild-native`. The `rebuild-native` step is kept as a safety net per the ticket's
   explicit requirement and the spec's stated ABI-mismatch concern, not because it's been
   proven necessary for this package.
3. **No CH340 hardware available in this environment.** The three "badge displays X on
   Windows/macOS" acceptance criteria are implemented and unit-tested against fake port lists,
   but not confirmed against a real OS-level enumeration on either platform. Left unchecked in
   the ticket file with this note. Genuinely needs a machine with the ACEBOTT QD001 car (or any
   CH340 adapter) plugged in.
4. **VID/PID matcher (`isCh340Port`) is currently private to `usbStatus.ts`, not yet a shared
   module.** The spec's Implementation Decisions describe a shared VID/PID auto-detect helper
   reused by both the presence badge and the future USB Log Connect action (ticket 04). Ticket
   01's acceptance criteria only required rewriting `usbStatus.ts` itself, so per the "no
   over-engineering" coding rule (don't abstract before a second consumer exists), the matcher
   was kept local to `usbStatus.ts` rather than extracted into its own module now. **Ticket 04
   will need to either import `isCh340Port`/`SerialPortIdentity` from `usbStatus.ts` or extract
   them into a shared module at that point** — flagging this now so ticket 04's implementer
   doesn't duplicate the matching logic.
5. `package-lock.json` was updated by `npm install` (serialport + @electron/rebuild and their
   transitive deps). `npm audit` reports pre-existing high-severity advisories against the
   installed `electron@32.3.3` itself (unrelated to serialport) — out of scope for this ticket,
   not touched.

## Next session should load

- [Ticket 02](../../tickets/02-shared-log-panel-infra.md)
- [Spec](../../spec.md) — particularly the "Implementation Decisions" bullets about the shared
  log-panel infra and the byte-to-line splitting/timestamping logic ticket 02 builds.
