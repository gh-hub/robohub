# 01 — [test] Fix failing usbStatus test on Windows

**What to build:** Fix the failing test `isUsbSerialDevicePresent returns true when a cu.usbserial-* entry exists in the directory` in `app/src/usbStatus.test.ts` (line 13) so the full suite passes on this Windows dev machine (currently 148/149). This is a pre-existing gap surfaced by the review gate — unrelated to the water-gun Pan-rename / discrete-rotate-buttons feature work; no diff line in this plan touches `usbStatus.ts` or `usbStatus.test.ts`.

**Root cause:** `isUsbSerialDevicePresent()` in `app/src/usbStatus.ts` (lines 33-42) returns `false` immediately when `process.platform !== "darwin"`, by design — per its doc comment, USB-serial detection is macOS-only (`/dev/cu.usbserial-*` is a macOS-specific device node pattern). The failing test at `usbStatus.test.ts:13-18` creates a temp directory containing a `cu.usbserial-1420` entry and asserts `isUsbSerialDevicePresent(dir) === true`, but never mocks `process.platform` to `"darwin"` first — so on this Windows machine the platform guard short-circuits and the function returns `false`, failing the assertion. The sibling test three lines below (`usbStatus.test.ts:31-42`, "returns false on non-macOS platforms even if a matching entry exists") already establishes the pattern for mocking `process.platform` via `Object.defineProperty(process, "platform", { value: ... })` with a `try/finally` restore — the failing test simply never applied that same mock for the `"darwin"` case.

**Blocked by:** None — can start immediately

**Status:** ready

- [x] Fix `usbStatus.test.ts:13-18`'s test to mock `process.platform` to `"darwin"` around its `isUsbSerialDevicePresent(dir)` call (matching the `Object.defineProperty(process, "platform", { value: "darwin" })` + `try/finally` restore pattern already used at lines 35-42 in the same file), so the test verifies the directory-scan logic on any host platform, not just macOS.
- [x] `npm test` (in `app/`) passes 149/149 with no other regressions.
- [x] `npm run typecheck` and `npm run build` (in `app/`) still pass with no errors.
- [x] No production code in `usbStatus.ts` changed — this is a test-only fix; the macOS-only runtime behavior is intentional per ADR-002 and must not change.
