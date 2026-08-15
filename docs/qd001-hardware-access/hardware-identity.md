# QD001: Confirmed hardware identity

Part of the [QD001 Hardware Access Guide](index.md). Gathered via the USB-serial connection described in [`connecting.md`](connecting.md).

## Confirmed hardware identity

| Field | Value |
|---|---|
| Chip | ESP32-D0WD-V3, revision v3.1 |
| Cores | Dual-core, 240MHz |
| Radios | WiFi (2.4GHz b/g/n) + Bluetooth 4.2 (present in silicon, **not used** — see [`firmware-analysis.md`](firmware-analysis.md)) |
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

## Where the raw data lives

- `tools/qd001-probe/dumps/qd001_flash_4MB.bin` — full 4MB flash dump (gitignored)
- `tools/qd001-probe/dumps/app0.bin` — extracted active firmware partition
- `tools/qd001-probe/dumps/spiffs.bin` — extracted SPIFFS partition (all `0xFF`, confirmed empty)
- `tools/qd001-probe/dumps/app0_strings.txt` / `app0_strings_short.txt` — `strings` output at `-n 5` and `-n 2`, used for [`firmware-analysis.md`](firmware-analysis.md)

These are regenerable any time the car is plugged in — see [`connecting.md`](connecting.md). Not committed to git (large, no diff value).

## USB-UART chip (confirmed live)

Checked via macOS `ioreg -p IOUSB -l -w0` while the car was plugged in over USB-C — this is a passive OS-level read, no `esptool` traffic involved:

| Field | Value |
|---|---|
| Vendor ID | `0x1A86` (QinHeng Electronics) |
| Product ID | `0x7523` |
| Device node | `/dev/cu.usbserial-110` (port number drifts per cable/port, as noted above) |

This resolves the "CP2102 or CH340?" open question from the deep-research report (`docs/deep-research-report.md:33`) — it's **CH340**, not CP2102.
