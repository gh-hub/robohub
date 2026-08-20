# Review round 3 — findings

## Spec match

Spec user story 7: *"I want the serial port cleanly closed when I click the USB Log Disconnect button or when I close the app, so that other tools can use the port immediately afterward, with no lingering lock."*

`main.ts`'s `before-quit` handler only closes the port when `usbSerialConnection.getState().status === "connected"` (`app/src/main.ts:69-73`). But in `UsbSerialConnection.connect()` → `openPort()` (`app/src/usbSerialConnection.ts:175-181`), the real `SerialPort` object is created synchronously via `this.openSerialPort(...)` while status is still `"connecting"` — `this.port` is only assigned after the `"open"` event resolves (`usbSerialConnection.ts:135-136`). If the app quits during that in-flight window, no reference exists anywhere to close the just-created port explicitly.

**Resolution: accepted as a documented limitation, not fixed in code.** Process termination itself releases the OS-level serial handle, so the port is not actually left locked for other tools once the app process has exited — the gap only affects the brief interval until then, not the "no lingering lock after quit" outcome the story actually cares about. Per user direction, this was judged not worth added in-flight-port-tracking complexity to close. Documented in [spec.md](../../spec.md)'s Further Notes.

## Security

No findings. Full sub-agent report:

> No new concrete, exploitable vulnerabilities were introduced by this diff.
>
> - **XSS**: `logPanel.ts`'s `renderLogPanel()` writes attacker-influenceable log content via `panelElement.textContent = lines.join("\n")` — `textContent`, not `innerHTML`. No injection path even though log lines are fully attacker-controlled bytes from an unauthenticated transport.
> - **Resource cleanup on close**: `before-quit` only disconnects when `status === "connected"`, matching the class's port-field invariant; `window.on("closed", ...)` unsubscribes all three new forwarders — no dangling `webContents.send` to a destroyed window.
> - **Unbounded memory/DoS**: both the `MAX_PENDING_LENGTH` cap and per-chunk batched `"log-lines"` emission (fixed in rounds 1/2) remain fixed.
> - **Deserialization/injection**: no JSON.parse, no shell/command construction, no SQL — log lines are opaque display strings only.
> - **Path traversal**: VID/PID matching only compares OS-enumerated strings from `SerialPort.list()`; nothing user-supplied builds a filesystem path.
> - **Dependencies**: `serialport@^13.0.0`/`@electron/rebuild@^4.2.0` resolve from the standard npm registry; no suspicious sources.
> - **IPC surface**: new channels follow the existing `contextBridge`-isolated pattern; nothing new crosses a privilege boundary.

## Gate results

- Lint: N/A — no lint command/config exists in this project
- Build (typecheck, both tsconfig projects): PASS
- Unit/integration tests: PASS (222/222)
- E2E tests: N/A — no e2e suite exists in this project

## Outcome

The one spec-match finding was resolved by documenting the accepted limitation in spec.md rather than a code fix. No security findings, gate fully green. Round 3 treated as effectively passing — proceeding to the pass checkpoint.
