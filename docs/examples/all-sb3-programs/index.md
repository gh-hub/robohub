# All sb3 programs: QD001-QD010 car-family kits

Every `.sb3` sample program for the QD001-QD010 car-family kits, pulled from the ACECode desktop app's own install (`C:\Program Files\ACECode\extraFiles\compile\sample-program\QD001~QD010(V1)\` and `QD001~QD010(V2)\`) — not from ACEBOTT's website, so this is ground truth for what the app itself ships/compiles against. 116 files total across 8 kits x 2 firmware generations. QD006 and QD009 don't exist in the ACECode install.

Layout is `<kit>/<version>/<...same subpath as the ACECode install>`. Each `.sb3` is a Scratch3 zip archive — `unzip foo.sb3 -d foo/` gets you `project.json` (the block program, readable JSON) plus its sound/costume assets. Open block opcodes with `grep -o '"opcode":"[^"]*"' project.json | sort -u`.

V1 and V2 are separate firmware generations, not duplicates — where they disagree, check [`../../qd001-hardware-access/hardware-identity.md`](../../qd001-hardware-access/hardware-identity.md) for which generation the physical unit actually runs. **Only `QD001/V2/` and `QD005/V2/` are implemented in this repo's `app/src/` today** — everything else here is reference material for kits/features not yet wired up.

## `QD001/` — base smart car

The kit this repo targets. `V2/` is canonical for anything running on the actual unit; see [`../QD001-V2-firmware-source/`](../QD001-V2-firmware-source/) for the actual C++ this compiles against.

- **`V2/4.3WebControlCar.sb3`** — the `carMotorV2_carWebInit`/`WEB_SERVER_*`/`WIFI_AP` block flow (web-control variant).
- **`V2/4.4.2APPControlCar2(Final program).sb3`** — the full app-control flow (`carMotorV2_carInit`, `carMotorV2_spiderExecute`, `carMotorV2_carGetInstruct`, `carMotorV2_getCarAppCommandData`) traced through to `ACB_CAR_ARM.cpp` for the protocol tables in [`../../qd001-hardware-access/protocol-reference.md`](../../qd001-hardware-access/protocol-reference.md).
- Everything else in `V1/` and `V2/` is single-feature tutorials (LED, buzzer, ultrasonic, line-tracking, IR remote).

## `QD002/` — camera module

Camera-only attachment. `6.x` = camera setup/test programs, `8.x` = final combined body+camera programs. Not implemented in `app/src/`.

## `QD003/` — vision/AI features

Color recognition/tracking, face recognition, traffic-sign recognition, visual patrol, image recognition, machine learning, culminating in `8.APP_Control(Final program).sb3`. Not implemented in `app/src/`.

## `QD004/` — app-control car variant

Single program (`APP_control_car.sb3`) per version. Not analyzed yet.

## `QD005/` — water-gun attachment

Matches this repo's already-implemented `DEVICE_SHOOT`/`DEVICE_SERVO` shoot/aim commands (`app/src/commandFrame.ts`). Two variants as shipped in both versions: `carA/` (base car + blaster, no camera) and `carB(with camera)/` (adds the QD002 camera module). Both include `Servo_Angle_Calibration.sb3` for the aim servo's mechanical zero-point.

## `QD007/` — robot arm car

Inverse kinematics, joint control, arm-stacking task, web-controlled arm car, culminating in `lesson4/App_Control(Final program).sb3`. Not implemented in `app/src/`.

## `QD008/` — solar car

`Servo_90.sb3` (servo calibration) + `Solar_Car.sb3`. Not implemented in `app/src/`.

## `QD010/` — controller/Bluetooth lessons

`lesson2/` — Lumi/Bluetooth-controller car control. `lesson3/` — PS3 controller programs for QD001, QD005, QD007, QD008, QD022 (note: QD022 isn't otherwise pulled into this repo — it's a different kit family referenced only here), plus a `6.game.sb3`. Not implemented in `app/src/`.

## Extending this

If a QD002/3/4/7/8/10 feature becomes in-scope for `app/src/`, cross-reference its firmware the same way `QD001-V2-firmware-source/` was pulled: grep `lib.min.js` from ACECode's `resources/app.asar` for the opcode, then find the matching `ACB_*` library source under `extraFiles/compile/`. See [`../../qd001-hardware-access/protocol-reference.md`](../../qd001-hardware-access/protocol-reference.md) for how that was done for QD001(V2).
