# Examples: QD001(V2) firmware source + sample programs

Local copies pulled from the ACECode desktop app's own install (`C:\Program Files\ACECode\extraFiles\compile\` on Windows), not from ACEBOTT's website — this is what the app itself compiles against, so it's ground truth for the V2 kit generation. See [`../qd001-hardware-access/protocol-reference.md`](../qd001-hardware-access/protocol-reference.md) for how this was found and what it resolved.

This is a **separate, newer source** from [`../ACEBOTT QD001 - smart car - base/`](<../ACEBOTT QD001 - smart car - base/>), which is the V1 kit's tutorial bundle (PDFs + `.sb3` + `.ino` + `.py`), already in this repo. Where the two disagree, prefer this V2 material for anything running on the actual unit today — check [`../qd001-hardware-access/hardware-identity.md`](../qd001-hardware-access/hardware-identity.md) for which firmware generation the physical car is actually running.

## `QD001-V2-firmware-source/`

The actual Arduino library C++ ACECode compiles QD001(V2) block programs against — not sample code, the real protocol decoder.

| File | What it is |
|---|---|
| `ACB_CAR_ARM.h` / `.cpp` | **Primary reference.** The class every `carMotorV2_*` block compiles down to (`arm_car` instance). Contains `parseData()` (binary TCP:100 frame decoder), `CarMove()` (dispatches decoded instruction codes to motor moves), `Carloop()` (the TCP:100 socket loop — same connection held open, byte-by-byte framing), `cmd_handler()` (the HTTP:80 `GET /control?var=car&val=...` endpoint), `startWebServer()`/`startAppServer()` (both open `WiFiServer(100)` unconditionally; the app/web choice only toggles whether `/` serves ACEBOTT's HTML page). Despite the "ARM" name, this is the generic V2 car base, used for QD001/QD002/QD003 too — not arm-specific. |
| `ACB_CAR_ARM1.h` / `.cpp` | A parallel/newer variant of the same class — adds `g_screen_pattern`/`g_screen_data` (dot-matrix display) and `g_mp3_volume`/`g_mp3_cmd` (MP3 module) static members not present in `ACB_CAR_ARM`. ~400 lines of diff between the two (`diff` them directly if you need specifics). Not yet confirmed which kits/blocks route to this variant vs. the base one — noted here as a known open question, not resolved. |
| `ACB_CAR_MOTOR.h` / `.cpp`, `vehicle.h` / `.cpp` | A separate, much smaller (~70-line) direct-movement wrapper (`forward()`/`backward()`/`left()`/`right()`/`stop()`/`speed()` calling into a `vehicle` object's `Move()`). This is what `carMotorV2_carMove`/`carMotorV2_carStop` compile to when used *outside* the app/web command-code flow — i.e. for tutorials that drive the car directly from blocks rather than parsing app instructions. |
| `ACB_CAR_ACTION.h` / `.cpp` | Small (~195 lines) supporting actions library; referenced by some `all-sb3-programs/QD001/V2/2.x`/`3.x` block programs. Not deeply analyzed yet. |

## `all-sb3-programs/`

Every `.sb3` sample program for the QD001-QD010 car-family kits — V1 and V2, all 8 kits that exist in the ACECode install (QD001, QD002, QD003, QD004, QD005, QD007, QD008, QD010; QD006/QD009 don't exist), 116 files total — organized as `<kit>/<version>/<...same subpath as the ACECode install>`. See its own [`index.md`](all-sb3-programs/index.md) for a per-kit breakdown; only `QD001/V2/` and `QD005/V2/` are implemented in this repo's `app/src/` today:

- **[`QD001/V2/`](<all-sb3-programs/QD001/V2/>)** — the exact kit this repo targets, 24 files from ACECode's Tutorial → Sample Program → QD001(V2) menu. Most relevant: `4.3WebControlCar.sb3` (the `carMotorV2_carWebInit`/`WEB_SERVER_*`/`WIFI_AP` web-control flow) and `4.4.2APPControlCar2(Final program).sb3` (the full app-control flow — `carMotorV2_carInit`, `carMotorV2_spiderExecute`, `carMotorV2_carGetInstruct`, `carMotorV2_getCarAppCommandData` — whose generated code was traced through to `ACB_CAR_ARM.cpp` for the protocol tables in [`../qd001-hardware-access/protocol-reference.md`](../qd001-hardware-access/protocol-reference.md)). Everything else (`1.x`-`3.x`) is single-feature tutorials (LED, buzzer, ultrasonic, line-tracking, IR remote).
- **[`QD005/V2/`](<all-sb3-programs/QD005/V2/>)** — QD001 + QD005 water-gun attachment, matching this repo's already-implemented `DEVICE_SHOOT`/`DEVICE_SERVO` shoot/aim commands (`app/src/commandFrame.ts`). Two variants: `carA/` (base car + blaster, no camera) and `carB(with camera)/` (adds the QD002 camera module). Both include `Servo_Angle_Calibration.sb3` for the aim servo's mechanical zero-point.

The V1 folders under `../` remain canonical for the original tutorial bundles (PDFs, `.ino`, `.py` alongside the `.sb3`s) — `all-sb3-programs/` mirrors just the `.sb3`s straight from the ACECode install.
