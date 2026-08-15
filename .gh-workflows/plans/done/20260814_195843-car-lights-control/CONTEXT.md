# Context: car-lights-control

## What we're building
Add two mirrored left/right light toggle buttons to the ACEBOTT control app, controlled over WiFi/TCP:100 protocol, no firmware changes.

## Key decisions

1. No firmware changes — control must work using only the existing WiFi/TCP:100 protocol as-is
2. Two toggle buttons with mirrored behavior (both control the same LED command since hardware doesn't support independent control)
3. App-tracked optimistic state (not queried from hardware; protocol has no state-readback channel)
4. Reset assumed state to "off" on every connect/reconnect
5. UI placement below existing Connect/Disconnect button, disabled when car not connected
6. Light control gated to tcp100 protocol only (HTTP:80 fallback has zero LED support)
7. Command-sending capability added to main-process `CarConnection` class via new IPC channels (see [grill/ADR-001.md](grill/ADR-001.md) for binary frame format)

## Tickets

1. [01 — Command-frame protocol layer on CarConnection](tickets/01-command-frame-protocol-layer.md)
2. [02 — Left/Right Light toggle buttons, IPC, and mirrored renderer state](tickets/02-light-toggle-ui-ipc.md)

## Current state
Phase: review (complete)
Current ticket: none
Completed tickets: [01 — Command-frame protocol layer on CarConnection](tickets/01-command-frame-protocol-layer.md), [02 — Left/Right Light toggle buttons, IPC, and mirrored renderer state](tickets/02-light-toggle-ui-ipc.md)

Plan complete.

## Load this session
- [Session notes from ticket 02](PROGRESS/notes/implement-02-light-toggle-ui-ipc.md) — full end-to-end feature summary and what review needs to know
- [spec.md](spec.md) — for spec-match review against the Implementation/Testing Decisions

## Gotchas
- Binary frame format documented in ADR-001.md was reverse-engineered from firmware source code, not yet live-tested against the user's actual car. Ticket 01 implemented `buildCommandFrame()`/`CarConnection.setLedState()` matching ADR-001 exactly and verified them with unit tests + a mock TCP server; ticket 02 wired the full UI/IPC path on top (`window.carAPI.setLights(on)` and the two light buttons). **Live-hardware confirmation still could not be performed** — this sandboxed environment has no network reachability to the physical car's Wi-Fi AP. This remains a genuine, flagged risk (not a blocker): the user needs to manually verify against their real QD001 (click a light button, or run `window.carAPI.setLights(true)` from devtools console once connected over tcp100) and report back if the LEDs don't respond, since the reserved-byte assumptions may need adjustment if the compiled firmware differs from the source examples ADR-001 was derived from.
- Exact left/right GPIO mapping is unconfirmed (source code and video tutorial narration disagree) but low-stakes since both LEDs driven identically by protocol; button labels are cosmetic only.
- Both light buttons render as `"Left Light: On/Off"` / `"Right Light: On/Off"` (mirrored `stateLabel` from `mapLightControlUiState`) — a judgment call on label presentation, not an explicit spec.md prescription. Flagged in ticket 02's notes in case review wants different wording; the underlying state plumbing is unaffected either way.
- All 47 tests pass (`npm test`), `tsc --noEmit` and `npm run build` are clean as of the end of ticket 02.
