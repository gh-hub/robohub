# QD001: Open questions / next steps

Part of the [QD001 Hardware Access Guide](index.md).

1. ~~Which protocol does the physical car actually speak — TCP:100 or HTTP:80?~~ — **Resolved, and it's both.** See [`protocol-reference.md`](protocol-reference.md) — the same C++ `ACB_CAR_ARM::val` state machine backs both, they aren't rival candidates.
2. ~~Command byte mapping (which bytes drive which motor/servo/blaster action)~~ — **Resolved.** See [`protocol-reference.md`](protocol-reference.md) — extracted from the actual Arduino library source ACEBOTT ships inside ACECode, not traffic capture or trial-and-error.
3. **SSID case mismatch** (`ESP32-CAR` in firmware vs `ESP32-Car` in `app/src/carConfig.ts`) should be checked against what actually appears in macOS's Wi-Fi menu. **Update:** ACEBOTT's own QD001(V2) sample programs disagree with each other on this — `4.4.2APPControlCar2(Final program).sb3` hardcodes `ESP32-CAR`, `4.3WebControlCar.sb3` hardcodes `ESP32-Car`. Doesn't resolve the mismatch, but confirms it isn't just this repo's typo — ACEBOTT's tutorials are internally inconsistent about it too. Still needs a live check against the actual AP name.
4. ~~What is the "P Module"?~~ — **Resolved.** User confirmed it's the passive buzzer ("P-B"), on GPIO 33.
5. ~~Confirm IR pin (4 vs 32) against the physical board~~ — **Resolved.** ACEBOTT's own QA052 shield product photos confirm GPIO 4 via the silkscreen `IO` header label, matching the video. The deep-research report's GPIO 32 was wrong.
6. **Identify the `U4` chip near the "Shoot" connector** — small SOIC IC dedicated to the QD005 blaster trigger circuit, part number unreadable even in the vendor's product photos. Would need either a sharper photo/physical inspection or datasheet-matching once the package pinout is visible.
