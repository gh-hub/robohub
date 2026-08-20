# 01 — Add `serialport` dependency; fix USB presence badge cross-platform

**What to build:** the USB presence badge correctly shows "USB: Connected" when the car is plugged in on Windows and macOS using native port enumeration, instead of always showing "Not connected" on non-macOS platforms. Add `serialport` as the app's first runtime dependency with its native-module rebuild step wired into the build/start scripts. Rewrite `usbStatus.ts` to call `SerialPort.list()` with VID/PID matching (0x1A86/0x7523) for the CH340 chip, dropping the macOS-only `process.platform` branch entirely. Keep the existing polling/push-on-change event shape.

**Blocked by:** None — can start immediately

**Status:** ready

- [x] `serialport` package added to `package.json`
- [x] `serialport` native rebuild wired into `npm run dev` (dev script) and `npm run build` (build script) — note: this project had no pre-existing `dev` script (only `start`); added `dev` as an alias for `start`, and wired a new `rebuild-native` script (`electron-rebuild -f -w serialport`) into `build`, which both `start` and `dev` depend on. Could not be verified end-to-end in this sandbox: it lacks Visual Studio Build Tools (`node-gyp`'s "Could not find any Visual Studio installation" error), so `npm run build`/`rebuild-native` needs verification on a dev machine with the native toolchain installed. `@serialport/bindings-cpp` ships N-API prebuilt binaries (`napi_versions: [8]`) for win32-x64/ia32/arm64 and darwin, resolved automatically at `npm install` time via its own `node-gyp-build` install step (confirmed working — `npm test` exercises the real binding successfully in this sandbox), so the app is very likely functional even without ever running `rebuild-native` on a given machine; the rebuild step is a safety net for ABI edge cases, not strictly required for this package.
- [x] `usbStatus.ts` rewritten to call `SerialPort.list()` with 0x1A86/0x7523 VID/PID matching for CH340
- [x] macOS-specific `process.platform` code path removed
- [x] Polling/push-on-change event shape (listener registration, callback signature, update frequency) unchanged — `startUsbStatusPolling`'s existing tests pass unmodified; `checkDevicePresent`'s signature was widened to accept `boolean | Promise<boolean>` (required since `SerialPort.list()` is inherently async) but synchronous callers still resolve synchronously within the same poll tick.
- [ ] Badge correctly displays "USB: Connected" when CH340 device is plugged in on Windows — needs manual hardware verification; no CH340 device available in this environment.
- [ ] Badge correctly displays "USB: Connected" when CH340 device is plugged in on macOS — needs manual hardware verification; no CH340 device or macOS machine available in this environment.
- [ ] Badge displays "USB: Not connected" when device is unplugged on both platforms — needs manual hardware verification; implied correct by `isUsbSerialDevicePresent`'s logic (unit-tested against fake port lists) but not confirmed against a real OS enumeration on either platform.
