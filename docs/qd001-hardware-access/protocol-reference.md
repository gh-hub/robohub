# QD001: Wire protocol reference (TCP:100 / HTTP:80)

Part of the [QD001 Hardware Access Guide](index.md). Traced from ACECode's own compiled firmware source — see [`../examples/index.md`](../examples/index.md) for the local copies this was extracted from.

## Firmware source ground truth (from ACECode's own compiler toolchain)

The ACECode desktop app (`C:\Program Files\ACECode` on Windows, `~/Library/Application Support/ACECode`-equivalent per-OS) ships the exact Arduino library source it compiles QD001(V2) block programs against, at `extraFiles/compile/sketch/ACB_CAR_ARM/src/ACB_CAR_ARM.{h,cpp}`. Local, durable copies of the relevant files (this library plus the QD001/QD005 `.sb3` tutorials) live in [`../examples/`](../examples/index.md) — read that folder's index first. The tutorial folder — `extraFiles/compile/sample-program/QD001~QD010(V2)/` — contains the `.sb3` block programs themselves (Scratch3 zip archives; `unzip` them to get `project.json`), but those only show *which blocks* a tutorial uses, not the wire protocol. The protocol itself lives one layer deeper:

- `.sb3` `project.json` → block opcodes like `carMotorV2_carGetInstruct`, `carMotorV2_carMove` (found by unzipping e.g. `QD001/4.4.2APPControlCar2(Final program).sb3`)
- opcode → generated C++, found by extracting the app's bundled code generator (`resources/app.asar` → `build/lib.min.js`, via `npx asar extract`) and searching for `Blockly.Arduino['carMotorV2_carGetInstruct']` — it compiles to reading `arm_car.val`, an instance of the `ACB_CAR_ARM` class
- `ACB_CAR_ARM.cpp`'s `parseData()`/`CarMove()`/`Carloop()`/`cmd_handler()` — the actual protocol implementation

**Where to get more, later.** Only QD001 + QD005 were pulled into `docs/examples/` (see that folder's "What wasn't copied" section) — QD002 (camera), QD003 (vision/AI), QD004, QD007 (robot arm car), QD008, and QD010 sample programs weren't in scope at the time. If one of those becomes relevant, the same install has everything, on the machine that has ACECode installed:

- Sample programs (`.sb3`, per kit): `C:\Program Files\ACECode\extraFiles\compile\sample-program\QD001~QD010(V2)\<kit>\`
- Firmware library source (`.h`/`.cpp`, the actual protocol decoders): `C:\Program Files\ACECode\extraFiles\compile\sketch\ACB_*\src\`
- The Blockly→Arduino/Python code generator (to trace a block opcode to its generated code): unpack `C:\Program Files\ACECode\resources\app.asar` with `npx asar extract app.asar <dest>`, then grep `<dest>/build/lib.min.js` for `Blockly.Arduino['<opcode>']`

Same extraction recipe as above: unzip the `.sb3` for the opcodes a tutorial uses → grep `lib.min.js` for those opcodes' generator functions → read the `ACB_*` library source the generator points at.

## Frame format and confirmed device codes

This **confirms `commandFrame.ts` byte-for-byte** (header `0xFF 0x55`, length byte, `action` at payload offset 6, `device` at offset 7, `value` at offset 9 — `parseData()` reads them at absolute frame offsets 9/10/12, which is the same thing once you account for the 3-byte header) and adds the following, previously-undocumented pieces:

**New device codes** (same `action=1` binary frame shape as the existing motor/LED/servo/shoot codes):

| Device byte | Meaning | Value byte |
|---|---|---|
| `0x03` (3) | Buzzer | `1`-`4` → melody 1-4; `0` → off |
| `0x0D` (13) | Speed | sets `Car_Speed`, the magnitude used by all subsequent movement commands (not itself a movement) |
| `0x1E`-`0x28` (30-40) | Vision/camera features (QD002/QD003 only) | QR code, barcode, number/color/image recognition, color tracking, visual line-follow, traffic-sign ID, machine learning, face recognition, photo-capture button |
| `0x29`-`0x2B` (41-43) | RGB LED strip | separate R/G/B channel values (distinct from device `0x05`'s simple on/off LED) |

**Action-only codes** (device byte irrelevant, unlike the `action=1` codes above):

| Action byte | Meaning |
|---|---|
| `3` | Stop |
| `4` | Line-follow, circular pattern |
| `5` | Line-follow, figure-8 pattern |
| `6` | Obstacle avoidance mode |
| `7` | Follow mode |

## HTTP:80 has a real command endpoint, not just a status page

`startWebServer()`/`startAppServer()` both call `WiFiServer(100)` (confirms TCP:100 is always live, regardless of the `carMotorV2_carInit` block's web/app choice) *and* register an `httpd` on the default port (80) with route `GET /control?var=car&val=<code>&s1=&s2=&s3=&s4=&s5=`. `val` is `atoi()`'d directly into the same `ACB_CAR_ARM::val` field the binary TCP parser writes — i.e. **HTTP:80 accepts the same 58-108 instruction-code space** driving the same `CarMove()`-style dispatch, just spelled as a decimal query param instead of a binary frame. `carConnection.ts` currently only uses HTTP:80 for a side-effect-free liveness GET on `/` — this `/control` route is a legitimate second way to drive the car, not yet wired up. (The `app`/`web` init choice only controls whether `/` itself serves ACEBOTT's HTML control page — `/control` is registered either way.)

## Caveat

The one gap this doesn't close: it's the *sample-program's shared library source*, generated for every QD001(V2) tutorial — not a dump of the specific firmware actually flashed to this unit (see [`firmware-analysis.md`](firmware-analysis.md), which is unit-specific). Treat it as very strong corroborating evidence, not a substitute for the live-probe/traffic-capture step, if anything here doesn't match observed behavior.
