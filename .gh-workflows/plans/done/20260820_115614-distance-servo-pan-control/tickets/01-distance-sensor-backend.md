# 01 — Protocol + IPC + connection backend

**What to build:** The full app-side command pathway for the distance-sensor servo, from protocol constant through to a callable `window.carAPI.setDistanceSensorAngle()`, with no UI yet. Mirrors the existing Aim servo pathway (`DEVICE_SERVO`/`setAimAngle`/`CAR_SET_AIM_ANGLE_CHANNEL`/`handleSetAimAngle`/`mapAimControlUiState`) exactly, renamed for "distance sensor".

Specifically:
- `app/src/commandFrame.ts`: add `DEVICE_DISTANCE_SENSOR = 0x04`, with a code comment flagging it as an unverified placeholder — the firmware has no `runModule()` handler for this device code yet; see this plan's spec.md for why.
- `app/src/carConnection.ts`: add `setDistanceSensorAngle(angle: number): Promise<void>`, building a command frame with `action: CMD_RUN, device: DEVICE_DISTANCE_SENSOR, value: angle`, same gating/rejection contract as `setAimAngle()` (inherited from `sendCommandFrame()`).
- `app/src/ipcChannels.ts`: add `CAR_SET_DISTANCE_SENSOR_ANGLE_CHANNEL = "car:set-distance-sensor-angle"`.
- `app/src/preload.ts`: inline the same channel constant (per this file's existing no-local-imports constraint), add `CarApi.setDistanceSensorAngle: (angle: number) => Promise<void>` to the interface and the `carAPI` object (`ipcRenderer.invoke(CAR_SET_DISTANCE_SENSOR_ANGLE_CHANNEL, angle)`), with a doc comment mirroring `setAimAngle`'s.
- `app/src/main.ts`: import the new channel constant and wire `ipcMain.handle(CAR_SET_DISTANCE_SENSOR_ANGLE_CHANNEL, handleSetDistanceSensorAngle)` (or whatever the existing wiring pattern for `setAimAngle` looks like — match it exactly).
- `app/src/carIpcHandlers.ts`: add `setDistanceSensorAngle(angle: number): Promise<void>` to `CarConnectionLike`; add `handleSetDistanceSensorAngle: (angle: number) => Promise<void>` to `CarIpcHandlers`; implement it in `createCarIpcHandlers()` with a runtime bounds check `isValidDistanceSensorAngle()` (integer, `MIN_DISTANCE_SENSOR_ANGLE=1` to `MAX_DISTANCE_SENSOR_ANGLE=180`), rejecting with `Invalid distance sensor angle: {value}` on failure — mirrors `handleSetAimAngle`/`isValidAimAngle` exactly.
- `app/src/connectionUiState.ts`: add `DistanceSensorControlUiState { leftDisabled: boolean; rightDisabled: boolean }` and `mapDistanceSensorControlUiState(connection: ConnectionState, angle: number): DistanceSensorControlUiState`, same gating (`connected && tcp100`) plus bound-edge disabling (`leftDisabled` at `angle <= MIN_DISTANCE_SENSOR_ANGLE`, `rightDisabled` at `angle >= MAX_DISTANCE_SENSOR_ANGLE`) as `mapAimControlUiState`.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] `DEVICE_DISTANCE_SENSOR = 0x04` added to commandFrame.ts with placeholder comment
- [x] `CarConnection.setDistanceSensorAngle()` implemented, frame uses device 0x04
- [x] `CAR_SET_DISTANCE_SENSOR_ANGLE_CHANNEL` added to ipcChannels.ts
- [x] `preload.ts` exposes `setDistanceSensorAngle` on `window.carAPI`
- [x] `main.ts` wires the new IPC channel to the new handler
- [x] `carIpcHandlers.ts`: `handleSetDistanceSensorAngle` + `isValidDistanceSensorAngle` implemented, rejecting out-of-range/non-integer angles
- [x] `connectionUiState.ts`: `mapDistanceSensorControlUiState` implemented with correct gating + bound-edge disabling
- [x] `connectionUiState.test.ts`: new test suite for `mapDistanceSensorControlUiState`, mirroring `mapAimControlUiState`'s test shape (gating cases + both bound-edge cases)
- [x] `carIpcHandlers.test.ts`: new tests for `handleSetDistanceSensorAngle` (valid/invalid angle sets, error message format), mirroring the Aim angle tests
- [x] `carConnection.test.ts`: new test asserting `setDistanceSensorAngle()` writes the exact expected frame bytes (device 0x04, action CMD_RUN)
- [x] `npm test`, `npm run typecheck`, `npm run build` all pass inside `app/`

**Implementation note (unplanned but required):** `app/src/renderer.ts` also had to receive a one-line, type-only addition — `setDistanceSensorAngle: (angle: number) => Promise<void>;` in its locally hand-synced `CarApi` interface (no UI wiring/behavior). This file's own header comment documents that its `CarApi` copy must be kept in sync with preload.ts's `CarApi` by hand, because both files' `declare global` `Window.carAPI` augmentations are merged into one TS program under the root `tsconfig.json` (which `npm run typecheck` uses) — without the mirrored signature, `tsc --noEmit` fails with "Subsequent property declarations must have the same type." This is a type-contract-sync requirement, not UI/renderer logic — no DOM wiring, event handlers, or HTML changes were made. See notes/implement-01-distance-sensor-backend.md for detail.
