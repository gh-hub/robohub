# QD001 Hardware Access Guide

Reference for connecting to the physical ACEBOTT QD001 car from this Mac and probing it directly (USB-serial and, later, Wi-Fi/TCP). Use this before re-doing discovery work that's already been done once.

For product specs and the officially-documented protocol theory, see [`../deep-research-report.md`](../deep-research-report.md). For the Electron app's own connection logic, see `app/src/carConnection.ts` and its plan at `.gh-workflows/plans/done/20260814_174351-acebott-control-app/`.

## Ground rules

- **Read-only by default.** Don't flash, erase, or write to the car's flash unless the user explicitly asks. All work so far has been `esptool.py` reads plus passive serial listening.
- **Wi-Fi join is a real action, not a no-op.** Joining `ESP32-CAR` disconnects this Mac from its normal network. Confirm with the user before doing it from an agent session (this was also flagged in the acebott-control-app plan's `CONTEXT.md`).
- Don't commit firmware dumps to git — they're large binaries with no diff value. `tools/qd001-probe/dumps/` is gitignored.

## USB-serial connection

1. Plug the car in via USB-C.
2. Find the device node:
   ```
   ls /dev/cu.usbserial-*
   ```
   On this Mac it enumerates as `/dev/cu.usbserial-10` (number may change per-port/per-cable). `system_profiler SPUSBDataType` is blocked in the agent sandbox — don't rely on it; the device-node listing plus `esptool.py chip_id` below is enough to confirm identity.
3. Python tooling lives in `tools/qd001-probe/` (its own venv, not the app's Node project):
   ```
   cd tools/qd001-probe
   python3 -m venv .venv        # only if .venv doesn't exist yet
   ./.venv/bin/pip install -r requirements.txt
   ```
4. Confirm the chip is alive:
   ```
   ./.venv/bin/esptool.py --port /dev/cu.usbserial-10 chip_id
   ```
5. **Baud rate note:** `460800` fails on this adapter/cable with `Invalid head of packet (0xFF)`. Use `115200` (default) for anything beyond `chip_id`/`flash_id` — a full 4MB flash read takes ~6 minutes at that speed.

## Confirmed hardware identity

| Field | Value |
|---|---|
| Chip | ESP32-D0WD-V3, revision v3.1 |
| Cores | Dual-core, 240MHz |
| Radios | WiFi (2.4GHz b/g/n) + Bluetooth 4.2 (present in silicon, **not used** — see below) |
| MAC | `00:70:07:a8:60:44` |
| Flash | 4MB (manufacturer ID `46`, device `4016`) |
| Serial adapter | `/dev/cu.usbserial-10` |

## Flash partition layout

Read via `esptool.py read_flash 0 0x400000` then parsed the ESP-IDF partition table at offset `0x8000` (32-byte entries, magic `AA 50`):

| Partition | Type | Offset | Size | Notes |
|---|---|---|---|---|
| `nvs` | data/nvs | `0x9000` | 20KB | key-value config storage |
| `otadata` | data/ota | `0xe000` | 8KB | OTA slot selector — `seq=1` on slot 0, slot 1 untouched (`0xFFFFFFFF`) → **`app0` is the only firmware ever run, no OTA update has happened** |
| `app0` | app/ota_0 | `0x10000` | 1.25MB | active application firmware — valid image, checksum/hash OK |
| `app1` | app/ota_1 | `0x150000` | 1.25MB | blank, never written |
| `spiffs` | data/spiffs | `0x290000` | 1.4MB | **completely blank (0% used)** — no stored web UI files on the device |
| `coredump` | data/coredump | `0x3f0000` | 64KB | crash dump area |

## Firmware analysis findings

Extracted via `strings` over `app0.bin` (the active application partition):

- **Toolchain:** Arduino-ESP32 core **2.0.12** (embedded Windows build paths from the vendor's build machine, e.g. `Arduino15\packages\esp32\hardware\esp32\2.0.12`). Not a raw ESP-IDF project — built through the Arduino IDE/CLI.
- **Wi-Fi AP SSID:** literal string `ESP32-CAR` (all caps). ⚠️ The app's `carConfig.ts` currently hardcodes `ESP32-Car` — verify the actual case shown in macOS's Wi-Fi list before assuming they match; SSIDs are case-sensitive.
- **AP password:** `12345678` appears in the strings table, consistent with the deep-research report's documented default.
- **No BLE/GATT code paths anywhere in the binary.** Confirms the earlier plan decision that Bluetooth control would require new firmware, not configuration.
- **`esp_http_server` is linked in** (`ESP_ERR_HTTPD_*` symbols present) — an HTTP server exists in the firmware.
- **SPIFFS is empty** — if the HTTP server responds at all, its responses are generated in C code, not served from stored HTML/JS/CSS files.
- **LEDC (hardware PWM) driver is linked in** — used for motor speed and/or servo angle control.
- **No plaintext command vocabulary found** — no `/cmd`-style routes, no JSON keys, no `"forward"`/`"stop"`-style strings anywhere in the binary. This strongly suggests the actual car-control protocol is a **compact binary format** sent over a raw socket, not HTTP+JSON or a REST-style API. Matches the acebott-control-app plan's existing decision to treat "binary TCP:100" as a real candidate alongside "HTTP:80."

## Where the raw data lives

- `tools/qd001-probe/dumps/qd001_flash_4MB.bin` — full 4MB flash dump (gitignored)
- `tools/qd001-probe/dumps/app0.bin` — extracted active firmware partition
- `tools/qd001-probe/dumps/spiffs.bin` — extracted SPIFFS partition (all `0xFF`, confirmed empty)
- `tools/qd001-probe/dumps/app0_strings.txt` / `app0_strings_short.txt` — `strings` output at `-n 5` and `-n 2`, used for the analysis above

These are regenerable any time the car is plugged in — see "USB-serial connection" above. Not committed to git (large, no diff value).

## Open questions / next steps

1. **Which protocol does the physical car actually speak — TCP:100 or HTTP:80?** Static analysis can't fully resolve this (binary protocol, no readable route strings). Needs either a live probe (join `ESP32-CAR`, run the app's existing `CarConnection` probe logic) or disassembly of the packet-handling function in `app0.bin`.
2. **Command byte mapping** (which bytes drive which motor/servo/blaster action) is still unknown — the binary protocol has no self-describing strings. Once a working socket is confirmed, this needs either traffic capture from the official ACEBOTT phone app, or systematic trial-and-error with the user watching the car's physical response.
3. **SSID case mismatch** (`ESP32-CAR` in firmware vs `ESP32-Car` in `app/src/carConfig.ts`) should be checked against what actually appears in macOS's Wi-Fi menu.
