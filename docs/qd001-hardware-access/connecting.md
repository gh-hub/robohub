# Connecting to QD001 over USB-serial

Part of the [QD001 Hardware Access Guide](index.md) — see that doc's Ground rules before doing anything here (read-only by default, Wi-Fi join is a real action).

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

See [`hardware-identity.md`](hardware-identity.md) for what this connection has already confirmed about the specific unit.
