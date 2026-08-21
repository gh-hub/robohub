# 01 — Full Pan→Aim rename across the entire stack

**What to build:** the complete identifier/label rename applied atomically across every layer in one batch, from the user's perspective: the app's "Pan Left/Right" servo control (which physically moves the QD005 water gun) becomes "Aim Up/Down" everywhere — the UI buttons, labels, and every internal identifier that refers to it.

**Blocked by:** None — can start immediately

**Status:** ready

- [x] Update `app/src/commandFrame.ts`: rename doc comment on `DEVICE_SERVO` from "pan servo" to "aim servo"
- [x] Update `app/src/connectionUiState.ts` and `.test.ts`: rename `MIN_PAN_ANGLE`/`MAX_PAN_ANGLE` constants to `MIN_AIM_ANGLE`/`MAX_AIM_ANGLE`; rename `PanControlUiState` interface to `AimControlUiState` with `leftDisabled`/`rightDisabled` → `upDisabled`/`downDisabled`; rename `mapPanControlUiState()` to `mapAimControlUiState()` with all tests updated
- [x] Update `app/src/ipcChannels.ts`: rename `CAR_SET_PAN_ANGLE_CHANNEL = "car:set-pan-angle"` to `CAR_SET_AIM_ANGLE_CHANNEL = "car:set-aim-angle"`
- [x] Update `app/src/preload.ts`: rename inlined channel constant reference and `CarApi.setPanAngle` method to `setAimAngle` with doc comments updated
- [x] Update `app/src/main.ts`: update import statement and `ipcMain.handle` wiring to use renamed channel and method names
- [x] Update `app/src/carIpcHandlers.ts` and `.test.ts`: rename `CarConnectionLike.setPanAngle` to `setAimAngle`; rename `handleSetPanAngle` to `handleSetAimAngle`; rename `MIN_PAN_ANGLE`/`MAX_PAN_ANGLE` to `MIN_AIM_ANGLE`/`MAX_AIM_ANGLE`; rename `isValidPanAngle()` to `isValidAimAngle()` with all tests updated including `FakeCarConnection` fields/methods, `VALID_PAN_ANGLES`/`INVALID_PAN_ANGLES`, and error-message regexes
- [x] Update `app/src/carConnection.ts` and `.test.ts`: update doc comment and rename `setPanAngle()` method to `setAimAngle()` with all test names and calls updated
- [x] Update `app/src/renderer.ts`: rename import references to use `CarApi.setAimAngle`; rename `type PanDirection` to `AimDirection` with `"left"|"right"` → `"up"|"down"`; rename `PAN_REPEAT_INTERVAL_MS` to `AIM_REPEAT_INTERVAL_MS`; rename `PAN_STEP_DEGREES` to `AIM_STEP_DEGREES`; rename `MIN_PAN_ANGLE`/`MAX_PAN_ANGLE` to `MIN_AIM_ANGLE`/`MAX_AIM_ANGLE`; rename state variables `panAngle`/`panSpeed`/`panHoldDirection`/`panRepeatTimer` to `aim*` equivalents; rename `renderPan()` to `renderAim()`; update `PAN_ANGLE_DELTA: {left:1,right:-1}` to `AIM_ANGLE_DELTA: {up:1,down:-1}` (same numeric values, flagged as unverified placeholder direction-sign pending hardware calibration); rename `stepPan()` to `stepAim()`; rename event handlers `handlePanPointerDown`/`handlePanRelease`/`stopActivePan`/`handlePanSpeedChange` to `handleAimPointerDown`/`handleAimRelease`/`stopActiveAim`/`handleAimSpeedChange`; rename `PAN_BUTTON_IDS` to `AIM_BUTTON_IDS` with button ids `pan-left-button`/`pan-right-button` → `aim-up-button`/`aim-down-button`; update event-listener wiring and `window.blur` handler reset blocks
- [x] Update `app/public/index.html`: rename element ids `#pan-controls`/`#pan-left-button`/`#pan-right-button`/`#pan-speed-select`/`#pan-angle-text` to `aim-*` equivalents (note: `#pan-controls` stays as a standalone div, not yet wrapped into a new section); update CSS selectors to match; replace button glyphs `&#9664; Left`/`&#9654; Right` with `&#9650; Up`/`&#9660; Down`; update label text from "Pan: 90°" to "Aim: 90°"
- [x] Verify zero leftover `pan`/`Pan`/`PAN` references in `app/src/` or `app/public/index.html` (grep case-insensitive for `\bpan\b` excluding unrelated matches like "log-panel"/"panel" should return nothing)
- [x] Run `npm test` in `app/` directory and verify all tests pass
- [x] Run `npm run typecheck` in `app/` directory and verify no type errors
- [x] Run `npm run build` in `app/` directory and verify successful build
