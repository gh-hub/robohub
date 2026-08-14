# Grill Session End-State

## Summary

The grill interview gathered requirements for building an Electron desktop app to control the ACEBOTT QD001 smart car over Wi-Fi. The scope is intentionally narrow: this plan covers only the initial connect/status UI (a single implementation ticket), with car movement control, gun control, and UI polish deferred to separate future plans.

### Problem

User owns two ACEBOTT robotics kits (QD001 smart car, QD002 water gun) and currently controls the car via the official phone app. Wants a custom macOS desktop app as an alternative control layer.

### Solution

Single-ticket Electron app (TypeScript, no framework) with:
- One-button connect/disconnect UI
- Automatic connection-drop detection
- Status display (disconnected/connecting/connected/error)
- TCP socket managed by Electron main process, renderer interacts via IPC
- User manually joins `ESP32-Car` Wi-Fi network before connecting
- Hardcoded config (IP 192.168.4.1, SSID `ESP32-Car`, port TBD)

### Key decisions made

1. **No Bluetooth** — car firmware has zero BLE support; Wi-Fi/TCP only
2. **Wi-Fi AP mode unchanged** — no firmware reflash; car stays as is, Mac loses internet while connected (tradeoff accepted)
3. **Narrow scope** — connect/status only; car movement, gun, UI polish are separate future plans
4. **Probe protocol during implementation** — don't guess TCP:100 vs HTTP:80; test both ports against real hardware first
5. **TypeScript + plain HTML/CSS** — no React/Vue
6. **Main process owns socket** — renderer uses IPC only, never raw sockets
7. **Manual Wi-Fi joining** — no programmatic `networksetup` calls
8. **Hardcoded config** — no settings UI needed yet
9. **Single toggle button** — not separate Connect/Disconnect buttons
10. **Event-based drop detection** — listen for socket `close`/`error`, don't poll
11. **Dev mode only** — no signed `.app`/`.dmg` packaging for this ticket
12. **`app/` subdirectory** — code lives in `app/` not at repo root

### Environment facts gathered

- Car runs MicroPython on ESP32 in Wi-Fi AP mode (SSID `ESP32-Car`, password `12345678`)
- Two mutually exclusive firmware examples exist: binary TCP protocol on port 100 (official phone app uses this), or simpler HTTP protocol on port 80
- **Which firmware the user's actual car runs is NOT confirmed yet and must be probed during implementation**
- AP-mode default gateway is `192.168.4.1`
- Zero BLE/Bluetooth support found in any ACEBOTT firmware example (QD001 or QD005)
- Repo state: only README.md and docs/ existed before plan started; no established code layout

### Architecture decisions (ADRs)

- **ADR-001:** Wi-Fi/TCP only, no Bluetooth — see [grill/ADR-001.md](../grill/ADR-001.md)
- **ADR-002:** Main process owns socket — see [grill/ADR-002.md](../grill/ADR-002.md)

## Next: spec phase

The spec phase should read:
- `grill/requirements.md` — full problem statement and environment details
- `grill/decisions.md` — all 12 decisions in detail
- `grill/glossary.md` — terminology reference
- `grill/ADR-001.md` and `grill/ADR-002.md` — architectural decisions

Then produce `spec.md` with full technical specification, acceptance criteria, and implementation approach for the single ticket.

