# QD001 Hardware Access Guide

Reference for connecting to the physical ACEBOTT QD001 car and understanding what's been found about it — hardware, firmware, and wire protocol. Use this before re-doing discovery work that's already been done once.

For product specs and the officially-documented protocol theory, see [`../deep-research-report.md`](../deep-research-report.md). For the Electron app's own connection logic, see `app/src/carConnection.ts` and its plan at `.gh-workflows/plans/done/20260814_174351-acebott-control-app/`. For firmware source and sample programs pulled from the ACECode toolchain, see [`../examples/index.md`](../examples/index.md).

## Ground rules

- **Read-only by default.** Don't flash, erase, or write to the car's flash unless the user explicitly asks. All work so far has been `esptool.py` reads plus passive serial listening.
- **Wi-Fi join is a real action, not a no-op.** Joining `ESP32-CAR` disconnects this Mac from its normal network. Confirm with the user before doing it from an agent session (this was also flagged in the acebott-control-app plan's `CONTEXT.md`).
- Don't commit firmware dumps to git — they're large binaries with no diff value. `tools/qd001-probe/dumps/` is gitignored.

## Reference docs

| Doc | Covers |
|---|---|
| [`connecting.md`](connecting.md) | USB-serial connection steps — device node, `qd001-probe` venv setup, `esptool.py` usage, baud-rate gotcha |
| [`hardware-identity.md`](hardware-identity.md) | Confirmed chip/flash identity, flash partition layout, USB-UART chip, where the raw flash dumps live |
| [`firmware-analysis.md`](firmware-analysis.md) | `strings`-based findings from `app0.bin` — toolchain, Wi-Fi AP credentials, BLE/IR/HTTP server presence, why the protocol is binary not JSON |
| [`pin-mapping.md`](pin-mapping.md) | Confirmed GPIO pin mapping (motors/servo/sensors/LEDs/IR/buzzer), QD005 water-gun wiring, QA052 shield vendor-photo cross-check, QB073 IR receiver module, inconclusive firmware pin cross-check |
| [`protocol-reference.md`](protocol-reference.md) | **The wire protocol.** TCP:100 binary frame format, HTTP:80 `/control` endpoint, full device/action/instruction-code tables — traced from ACECode's own compiled firmware source, plus where to pull more sample programs if a new kit/feature comes into scope |
| [`open-questions.md`](open-questions.md) | What's still unresolved, and what's already been closed out |

Start with [`protocol-reference.md`](protocol-reference.md) if you're implementing or debugging `app/src/carConnection.ts` or `commandFrame.ts`. Start with [`connecting.md`](connecting.md) if you're about to plug the car in.
