# Review round 2 — findings

## Spec match

**Round-1 fixes verified as correctly landed:**
- `UsbSerialConnection.connect()` (`app/src/usbSerialConnection.ts:107-132`) now always resolves once initiated — rejects synchronously only for `connecting`/`connected` state, mirrors `CarConnection`'s contract exactly (confirmed by test at `app/src/usbSerialConnection.test.ts:85-95,109-121`).
- New `CAR_USB_LOG_STATUS_CHANNEL` (`app/src/ipcChannels.ts`) + `forwardUsbLogStatus()` (`app/src/usbLogIpcHandlers.ts:87-100`), wired in `app/src/main.ts:120-122`, pushes connect success/failure to the renderer.
- Renderer now shows a visible operator-facing message via `mapUsbLogControlUiState()` (`app/src/connectionUiState.ts:1338-1372`) driving `#usb-log-status-text`, not just `console.error`.
- `"dev"` script is gone from `app/package.json`; scripts are now `rebuild-native`, `build`, `start`, `typecheck`, `test` only.

**(c) Requirement implemented but wrong — port can leak past an "error" event**

Spec user story 7: "I want the serial port cleanly closed when I click the USB Log Disconnect button or when I close the app, so that other tools can use the port immediately afterward, with no lingering lock." In `attachSessionListeners()` (`usbSerialConnection.ts:200-202`), a non-closing `"error"` event (e.g. a failed write) sets `status: "error"` but never calls `port.close()` and never clears `this.port`. After that: `disconnect()` rejects synchronously (state isn't `"connected"`), and `main.ts`'s `before-quit` handler (`main.ts:62-66`) only calls `disconnect()` when `status === "connected"`. A subsequent `connect()` opens a brand-new port without closing the stale handle. Net effect: the OS-level serial handle can remain open/locked with no code path left to close it, contradicting the "no lingering lock" guarantee.

**(b) Minor scope creep**

`LogLineBuffer`'s `MAX_PENDING_LENGTH` discard-on-oversized-partial-line behavior (`app/src/logLineBuffer.ts:24,72-77`) isn't called for anywhere in spec.md's buffering decision ("buffers partial data and splits on newline boundaries itself... discarding the carriage-return byte"). It's a deliberate, justified fix for round 1's security finding (unbounded memory growth), but spec.md doesn't document it — resolve by updating spec.md to reflect this now-required behavior, not by reverting the fix.

## Security

**Round-1 DoS fix verified — holds.** `LogLineBuffer.push()` (`app/src/logLineBuffer.ts:67-84`) caps `pending` at `MAX_PENDING_LENGTH` (16KB) and discards (never emits) the buffered partial data once exceeded. Both consumers (`carConnection.ts:291-296` tcp100 path, `usbSerialConnection.ts:177-182` USB path) create a fresh `LogLineBuffer` per session and route all `data` chunks through it — no bypass found.

**New finding — unbounded per-line emission rate (resource-exhaustion DoS), not addressed by the round-1 fix.**

The round-1 cap only bounds the *unterminated partial buffer*; it does nothing to bound how many complete lines a single chunk can produce. A chunk consisting mostly of `\n` bytes (e.g. a 64KB TCP payload of newlines) makes one `push()` call return tens of thousands of lines in one synchronous loop:
```js
socket.on("data", (chunk: Buffer) => {
  for (const line of logLineBuffer.push(chunk)) {
    this.emit("log-line", line);
  }
});
```
Each line triggers a synchronous `emit` → `webContents.send` IPC call (`main.ts:102-104`, `120-122`) and, in the renderer, `appendLogLines` + `renderLogPanel`'s `textContent`/`scrollTop` reflow (`logPanel.ts:51-57`) per message. Since the tcp100 socket is explicitly unauthenticated/unencrypted, any LAN attacker who can spoof or MITM the car's TCP endpoint can send a newline-flood payload to stall the single-threaded main process and freeze the renderer via tens of thousands of back-to-back IPC sends/DOM reflows — a straightforward CPU-exhaustion DoS the buffer-size cap does not mitigate. Same applies to a malfunctioning/malicious USB-serial peer on the USB path.

**Non-findings:** No XSS (log panels and USB Log status text use `textContent` throughout), no path traversal (serial port paths come from OS enumeration, not user input), nothing concerning in the pinned `serialport@13.0.0`.

## Gate checklist

| Check | Result |
|---|---|
| Lint | N/A — no lint command/config exists in this project |
| Build (typecheck, both tsconfig projects) | PASS |
| Unit/integration tests | PASS (218/218) |
| E2E tests | N/A — no e2e suite exists in this project |
