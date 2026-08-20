# QD001: Pin mapping and shield hardware

Part of the [QD001 Hardware Access Guide](index.md).

## Pin mapping (from ACEBOTT assembly-video transcript, user-supplied)

The deep-research report's pinout table (`docs/deep-research-report.md:109-128`) was explicitly speculative/generic ("exact pins... can be assigned in code"). The user supplied a transcript of ACEBOTT's own assembly video for this kit, which gives concrete pin numbers instead. Recorded here as the more trustworthy source until independently verified against the actual board silkscreen:

| Module | Pin(s) | Notes |
|---|---|---|
| Motors | M1 (upper-left), M2 (lower-left), M3 (upper-right), M4 (lower-right) | Shield-labeled ports, not raw GPIOs |
| Servo | GPIO 25 | Brown wire = GND |
| Ultrasonic | Trig = GPIO 13, Echo = GPIO 14 | VCC→5V, GND→GND |
| Line-tracking sensor | "line track" port | Red wire = 5V |
| LED (lower-left module) | GPIO 2 | Black wire = GND |
| LED (upper module) | GPIO 12 | Black wire = GND |
| IR receiver | GPIO 4 | ⚠️ **Conflicts with deep-research report**, which guessed GPIO 32 (`docs/deep-research-report.md:119`) — resolved in the video's favor, see below |
| Passive buzzer ("P-B", mistranscribed as "P Module") | GPIO 33 | Black wire = GND. User confirmed 2026-08-15: this is the passive buzzer, not an unknown sensor |

General wire color code for 3-pin→2-pin module cables: **blue = signal, red = voltage, black = ground**.

**Physical layout (from the same assembly-video source):**
- The car shield mounts on the **front side of the upper acrylic board**.
- Named ports on the shield silkscreen: `M1`–`M4` (motors), `line track` (tracking sensor), `ultrasonic` (ultrasonic sensor) — these are labeled headers, not raw GPIO pins.
- A **round hole** in the upper acrylic plate is the routing point for wires coming up from modules mounted on the lower plate (tracking sensor, lower LEDs) to reach the shield.
- The battery holder cable plugs directly into a port on the shield.

**Source priority: the video transcript wins on any conflict.** The deep-research report (`docs/deep-research-report.md`) was compiled from generic public web research about this kit family, not verified against this specific unit. The assembly-video transcript is from ACEBOTT's own material for the kit the user actually built. Wherever the two disagree (e.g. the IR pin above), treat the video as correct and the report entry as superseded/wrong.

## QD005 Water Ball Launcher (user-supplied, from ACEBOTT source material)

The QD005 blaster attachment connects to the shield in up to three places:

| Function | Port | Notes |
|---|---|---|
| Aiming (servo) | **GPIO 26** | Brown wire = GND. **Matches one of the two "spare" servo channels found on the QA052 shield's `Servo` header (25/26/27)** — confirms 26 is real and in-use, not just present in silkscreen |
| Firing (blaster trigger) | `shoot` port | The same 2-pin JST connector identified in the shield photos, next to the unidentified `U4` chip — confirms that chip's role: it's the shoot/blaster driver, not something unrelated |
| Camera (only on QD001+QD002+QD005 bundles) | **UART port** | Black wire = GND. **Not currently connected on this unit** (confirmed by user, 2026-08-15) — don't expect camera-related UART traffic when probing |

**The camera-via-UART detail resolves something flagged earlier as odd:** the firmware analysis found a leftover string `"Camera Ready! Use 'http://...' to connect"` in `app0.bin` but no OV2640/SCCB camera-driver code compiled in (see [`firmware-analysis.md`](firmware-analysis.md)). If the QD002 camera is a **separate serial module wired to the shield's UART port** — its own MCU/camera board, not a sensor directly wired to the main ESP32's camera-capable GPIOs — that fully explains the gap: the main ESP32 firmware never needs an embedded camera driver because the camera does its own image capture and just talks over UART. The leftover string is more likely a vestige of shared ACEBOTT firmware/template code than evidence of an unused local camera driver.

## Confirmed via vendor product photos (QA052 shield, shop.acebott.com)

ACEBOTT's own listing for the **QA052 ESP32 Car Shield V1.0** (`shop.acebott.com/products/acebott-qa052-esp32-car-shield-v1-0`) has high-res photos of the shield's top silkscreen, sharp enough to read every chip marking and header label directly — the strongest source found so far, since it's neither a third-party guess nor a transcript. This **independently confirms** several things the video said, and resolves the motor-driver-chip question the deep-research report only speculated on.

**Motor driver chips — resolved:** two **ST L293DD** ICs (labeled `U2`, `U3`), STMicroelectronics dual H-bridge drivers, one per motor pair. This replaces the deep-research report's speculative "L298N or TB6612, possibly with a 74HC595 shift register" (`docs/deep-research-report.md:48,69`) — there is no shift register on this board; the two L293DDs drive M1–M4 directly.

**Voltage regulator:** `Q1` is an **LM1085-5.0** (fixed 5V linear regulator, TO-220), stepping the 6–15V `Vin` battery input down to the 5V logic/sensor rail.

**Unidentified:** a small SOIC chip (`U4`) sits next to the 2-pin **"Shoot"** connector (for the QD005 blaster attachment) — text unreadable even at the product photos' resolution. Likely a small driver/logic IC dedicated to the blaster trigger, separate from the two motor-drive L293DDs. Not identified yet.

**Header labels, read directly off the silkscreen** — this confirms the video's pin numbers independently, not just repeats them:

| Labeled header | Pins | Cross-check |
|---|---|---|
| `Ultrasonic` | 5V, **13**, **14**, GND | Matches video (Trig=13, Echo=14) exactly |
| `LineTrack` | 5V, GND, 35, 36, 39 | New: the 3-channel line sensor uses GPIO 35/36/39 |
| `Servo` (×3 ports) | 25, 26, 27 (each with 5V/GND) | Matches video's servo=GPIO 25; two more servo channels exist (26, 27) unused by the base kit |
| `IO` block A | 12, 2 (each with 3V3/5V and GND) | Matches video's LED pins (12, 2) |
| `IO` block B | 34, 33, 4 | Matches video's "P Module"=33 and IR=4 — **confirms GPIO 4 for IR, not GPIO 32** |
| `I2C` | SCL, SDA, 5V, GND | Dedicated 4-pin header, separate from the SCL/SDA also broken out on the top edge |
| `UART` | TX, RX, 5V, GND | Dedicated 4-pin header |
| `M1`–`M4` | JST motor plugs | Driven by the two L293DDs, not raw GPIO |
| `Shoot` | 2-pin JST | QD005 blaster connector, driven via the unidentified `U4`/nearby transistor circuit — separate from the generic IO/Servo headers |

Net effect: **the IR-pin conflict is now resolved in the video's favor** — GPIO 4 is confirmed by the vendor's own board silkscreen, not just the transcript. The deep-research report's GPIO 32 guess was wrong. GPIO 33 (the "P Module" pin) is confirmed as a real, wired IO header — the board's silkscreen just labels it generic `IO`; the user separately confirmed it's the **passive buzzer** ("P-B"), not an unknown sensor.

Source images saved locally for reference at `/private/tmp/claude-502/-Users-gil-hadad-gilhadad-com-projects-robohub/0411c696-af66-48dc-bfdc-e7a12033525b/scratchpad/qa052_images/` (session scratchpad, not in the repo — re-download from the product page if needed later).

## IR receiver module (QB073, shop.acebott.com)

Product photos of ACEBOTT's **QB073 IR Receiver** module (`shop.acebott.com/products/acebott-qb073-ir-receiver-module`) confirm the physical part: the metal-can sensor is marked **"1838"** — the standard TL1838/VS1838B/HS0038-family 38kHz IR demodulator used in most Arduino IR-remote kits (photodiode + bandpass amp + AM demodulator in one package). It's a receive-only sensor: it pulls its output LOW on a burst of 38kHz-modulated IR and idles HIGH otherwise, so the GPIO sees a raw pulse-timing stream that encodes whichever remote button was pressed (typically NEC protocol, per the deep-research report).

Wiring: 3-pin JST, labeled **S / V / G** directly on the module's silkscreen — matches the assembly video's wire-color convention (blue=S, red=V, black=G) and the confirmed **S → GPIO 4** assignment above.

**Not currently exercised by the firmware:** `app0_strings.txt` has zero IR-related symbols (`IRrecv`, `IRremote`, `RMT_`, `NEC` — none present). So while the module is physically wired to GPIO 4, the firmware currently on the car never reads it. Pressing a remote button does nothing with the stock firmware as flashed today — this is hardware capability without corresponding firmware support, same pattern as the BLE radio.

Source images saved locally at `/private/tmp/claude-502/-Users-gil-hadad-gilhadad-com-projects-robohub/0411c696-af66-48dc-bfdc-e7a12033525b/scratchpad/qb073_images/` (session scratchpad, not in the repo).

### Attempted firmware cross-check (inconclusive)

Tried to corroborate the video's pins (4, 25, 13, 14, 2, 12, 33) against `app0.bin` by searching for the byte-shape of an ESP-IDF `gpio_config_t` struct (`pin_bitmask` + `mode`/`pull_up`/`pull_down`/`intr_type`) per pin. Result: **no reliable confirmation either way.**

- Pins 4, 14, and 12 produced zero plausible matches.
- Pins 13, 2, 32, and 33 produced matches, but with `mode=0` (`GPIO_MODE_DISABLE`) in almost every case — inconsistent with a pin actually being used as an active input/output — and the pin-32/33 hits sit at suspiciously regular offsets typical of a generic internal ESP-IDF pin-capability table, not an application-level config call.
- Likely cause: Arduino's `pinMode()` builds this struct at runtime via individual register stores, so it may never exist as a contiguous literal blob in the flash image to find this way.

Confirming pin assignments from the binary would need real Xtensa disassembly (`xtensa-esp32-elf-objdump`), which isn't installed in this environment. Until that's done (or the pins are checked against the physical board/live serial output), **treat the video transcript as the working source**, not because it's been independently verified, but because it outranks the report per the source-priority note above.
