# QD001: Firmware analysis findings

Part of the [QD001 Hardware Access Guide](index.md). Extracted via `strings` over `app0.bin` (the active application partition) — see [`hardware-identity.md`](hardware-identity.md) for where that dump lives and how it was pulled.

- **Toolchain:** Arduino-ESP32 core **2.0.12** (embedded Windows build paths from the vendor's build machine, e.g. `Arduino15\packages\esp32\hardware\esp32\2.0.12`). Not a raw ESP-IDF project — built through the Arduino IDE/CLI.
- **Wi-Fi AP SSID:** literal string `ESP32-CAR` (all caps). ⚠️ The app's `carConfig.ts` currently hardcodes `ESP32-Car` — verify the actual case shown in macOS's Wi-Fi list before assuming they match; SSIDs are case-sensitive. (See [`open-questions.md`](open-questions.md) — ACEBOTT's own sample programs disagree on this too.)
- **AP password:** `12345678` appears in the strings table, consistent with the deep-research report's documented default.
- **No BLE/GATT code paths anywhere in the binary.** Confirms the earlier plan decision that Bluetooth control would require new firmware, not configuration.
- **No IR-decode code paths either** — no `IRrecv`/`IRremote`/`RMT_`/`NEC` symbols. The IR receiver module (GPIO 4, see [`pin-mapping.md`](pin-mapping.md)) is wired up on the shield but the current firmware never reads it — pressing a remote button does nothing with what's currently flashed to `app0`.
- **`esp_http_server` is linked in** (`ESP_ERR_HTTPD_*` symbols present) — an HTTP server exists in the firmware. Confirmed and fully mapped in [`protocol-reference.md`](protocol-reference.md).
- **SPIFFS is empty** — if the HTTP server responds at all, its responses are generated in C code, not served from stored HTML/JS/CSS files.
- **LEDC (hardware PWM) driver is linked in** — used for motor speed and/or servo angle control.
- **No plaintext command vocabulary found** — no `/cmd`-style routes, no JSON keys, no `"forward"`/`"stop"`-style strings anywhere in the binary. This strongly suggests the actual car-control protocol is a **compact binary format** sent over a raw socket, not HTTP+JSON or a REST-style API. Matches the acebott-control-app plan's existing decision to treat "binary TCP:100" as a real candidate alongside "HTTP:80" — since resolved, see [`protocol-reference.md`](protocol-reference.md).
