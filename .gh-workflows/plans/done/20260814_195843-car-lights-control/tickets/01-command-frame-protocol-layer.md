# 01 — Command-frame protocol layer on CarConnection

**What to build:** A generic binary-frame builder that constructs frames per ADR-001's format, plus a frame-sending capability on the main-process `CarConnection` class that transmits built frames over the open TCP socket when connected and on the tcp100 protocol, rejecting without writing when disconnected or using http80 fallback.

**Blocked by:** None — can start immediately

**Status:** ready

- [x] Frame builder produces exact byte sequence per ADR-001 for LED on/off test cases
- [x] Frame builder zero-fills reserved bytes as documented
- [x] Frame sending rejects without writing to socket when disconnected
- [x] Frame sending rejects without writing to socket when protocol is http80
- [x] Frame sending writes exact bytes to TCP socket when connected on tcp100 protocol
- [x] Mock-TCP-server tests confirm LED-on and LED-off command bytes received on the wire
- [x] Pure-function unit tests cover frame builder across device/action/value combinations
- [ ] Live-hardware confirmation: manual devtools-console call against real car with frame builder — **not done, cannot be done in this sandboxed environment (no network access to the physical car).** `buildCommandFrame({ action: CMD_RUN, device: DEVICE_LED, value: 1 })` produces bytes matching ADR-001 exactly per the unit tests, and `CarConnection.setLedState(true/false)` sends those bytes verbatim to whatever tcp100 socket is open (verified against a mock TCP server), but nothing here confirms ADR-001's reverse-engineered layout actually toggles the real QD001's LEDs. This is a genuine open risk flagged in ADR-001 itself ("Live verification pending") — remains a manual step for the user to run once building against real hardware is possible, not a blocker for this ticket's code being correct against the documented spec.
