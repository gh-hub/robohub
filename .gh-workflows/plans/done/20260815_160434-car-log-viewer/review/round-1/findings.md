# Review round 1 — findings

## Spec match

**(c) Implemented but diverges from spec — USB Log connect/disconnect promise contract**

Spec says: "Two more new channels handle the USB Log Connect/Disconnect actions themselves, following the same 'resolves once initiated, rejects synchronously for an invalid current state' contract already used for the existing Wi-Fi connect/disconnect actions."

The Wi-Fi `CarConnection.connect()` always **resolves** once initiated — success/failure is reported later via the separate `state-change`/status-push channel. `UsbSerialConnection.connect()` (`app/src/usbSerialConnection.ts:106-134`) does not follow this: it additionally **rejects asynchronously** ("No CH340 serial adapter detected", or "Failed to open <path>: …") after the synchronous state check passes. This is a real behavioral difference from the pattern spec.md says to mirror, and it exists because no USB-Log status-push channel was built (only connect/disconnect/log-line channels — see `ipcChannels.ts`). The renderer's only handling of that rejection is `console.error(...)` (`app/src/renderer.ts` `handleUsbLogToggleClick`) — there's no visible operator-facing error surfacing for "no CH340 found" or "port already in use," so a failed Connect attempt just silently reverts the button with no explanation in the UI.

**(b) Scope creep**

`app/package.json` adds `"dev": "npm run start"`. Spec's Implementation Decisions only call for a `rebuild-native` step wired into "the existing build/start scripts" — a new `dev` alias isn't mentioned anywhere in spec.md.

**(a) Missing/partial**

Nothing else substantive is missing — all 16 user stories, the buffering/timestamp/cap/auto-scroll/Clear behavior, the tcp100-only log-line scoping, the shared VID/PID helper, and the enumeration-only badge fix all check out against spec.md and ADR-001/002 as described.

No other scope creep or wrong-implementation issues found; the rest of the diff (`carConnection.ts`, `logLineBuffer.ts`, `ch340Port.ts`, `usbStatus.ts`, `carIpcHandlers.ts`, `logPanel.ts`, `index.html`) matches spec.md closely, including correct discard-of-partial-line-on-session-end and fresh-buffer-per-session behavior.

## Security

**Finding: Unbounded memory growth (DoS) in `LogLineBuffer.push()`**

`app/src/logLineBuffer.ts`:
```js
push(chunk: Buffer | string): string[] {
  this.pending += typeof chunk === "string" ? chunk : chunk.toString("utf8");
  const segments = this.pending.split("\n");
  this.pending = segments.pop() ?? "";
  ...
}
```
`this.pending` has no size cap. It's fed directly from raw socket bytes in both new call sites:
- `carConnection.ts`: `socket.on("data", (chunk) => { for (const line of logLineBuffer.push(chunk)) ... })` — the tcp100 socket to the car, plain TCP with no TLS.
- `usbSerialConnection.ts`: same pattern on the CH340 serial port's `"data"` event.

**Exploit scenario:** Any peer that can write to the TCP socket (the car firmware itself, or — since this is unencrypted plain TCP — anyone on the same Wi-Fi/LAN able to MITM or spoof the car's IP/port) can send an endless stream of bytes containing no `\n`. Every chunk is appended to `pending` with nothing ever popped off (since `split("\n")` yields exactly one segment, and it's always re-assigned back to `pending`), so the buffer grows without bound for the lifetime of the session, exhausting the Electron main process's memory and crashing/hanging the app (renderer included, since the whole desktop app is one process tree). Same applies to a malfunctioning or malicious USB-serial device sending newline-free noise. This is new: the buffer was introduced by this diff and never existed before, and nothing in `carConnection.ts`/`usbSerialConnection.ts` bounds chunk count or byte size before calling `push()`.

**Non-findings worth noting:** `logPanel.ts`'s `renderLogPanel()` correctly uses `panelElement.textContent = lines.join("\n")` (not `innerHTML`), so car-supplied log text cannot inject markup/script into the renderer DOM — no XSS here despite the untrusted-input source. `preload.ts` uses `contextBridge`/`ipcRenderer.invoke` properly, no raw Node exposure. The pinned `serialport@13.0.0` version shows nothing obviously concerning in the lockfile.

## Gate checklist

| Check | Result |
|---|---|
| Lint | N/A — no lint command/config exists in this project |
| Build (typecheck, both tsconfig projects) | PASS |
| Unit/integration tests | PASS (206/206) |
| E2E tests | N/A — no e2e suite exists in this project |
