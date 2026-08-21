# 02 — Renderer UI + HTML section

**What to build:** The visible, usable Distance Sensor Left/Right control in the running app — DOM wiring in `renderer.ts` and a new HTML section in `index.html` — wired to the backend pathway ticket 01 delivers. Mirrors the existing Aim Up/Down renderer code (`renderAim`, `stepAim`, `handleAimPointerDown/Release`, `stopActiveAim`, `handleAimSpeedChange`, and their supporting constants/state) exactly, renamed for "distance sensor" with Left/Right instead of Up/Down.

Specifically:
- `app/src/renderer.ts`:
  - Add `CarApi.setDistanceSensorAngle` to the locally-redeclared `CarApi` interface (this file redeclares preload.ts's shape by hand — see the file's top comment).
  - Add `type DistanceSensorDirection = "left" | "right"`.
  - Add constants: `DISTANCE_SENSOR_REPEAT_INTERVAL_MS = 400`, `DISTANCE_SENSOR_STEP_DEGREES: Record<"fast"|"slow", number> = {fast: 10, slow: 5}`, `MIN_DISTANCE_SENSOR_ANGLE = 1`, `MAX_DISTANCE_SENSOR_ANGLE = 180`, `DISTANCE_SENSOR_ANGLE_DELTA: Record<DistanceSensorDirection, 1|-1> = {left: -1, right: 1}` (flagged unverified, same comment style as `AIM_ANGLE_DELTA`).
  - Add state: `let distanceSensorAngle = 90`, `let distanceSensorSpeed: "fast"|"slow" = "fast"`, `let distanceSensorHoldDirection: DistanceSensorDirection | null = null`, `let distanceSensorRepeatTimer: ReturnType<typeof setInterval> | null = null`.
  - Add `renderDistanceSensor(state)`, `stepDistanceSensor(direction)`, `handleDistanceSensorPointerDown(direction)`, `handleDistanceSensorRelease(direction)`, `stopActiveDistanceSensor()`, `handleDistanceSensorSpeedChange(event)` — same shape as the equivalent Aim functions, targeting DOM ids `distance-sensor-left-button`/`distance-sensor-right-button`/`distance-sensor-angle-text`/`distance-sensor-speed-select`.
  - Call `renderDistanceSensor(state)` from the top-level `render()` function alongside `renderAim(state)`.
  - Add `DISTANCE_SENSOR_BUTTON_IDS: Record<DistanceSensorDirection, string>` and wire pointerdown/pointerup/pointerleave/pointercancel listeners in the same loop-based pattern used for `AIM_BUTTON_IDS`.
  - Wire the `distance-sensor-speed-select` change listener to `handleDistanceSensorSpeedChange`.
  - Add `stopActiveDistanceSensor()` to the `window.addEventListener("blur", ...)` handler alongside `stopActiveAim()`.
  - In the `window.carAPI.onStatus(...)` handler: reset `distanceSensorAngle = 90` at the same three reset points (`connected`/`disconnected`/`error`) as `aimAngle`; call `stopActiveDistanceSensor()` at the same point `stopActiveAim()` is called (leaving `connected`+`tcp100`).
- `app/public/index.html`:
  - Rename the CSS class `.qd005-section` → `.boxed-section` (and its `h2` child selector) in the `<style>` block, and update the QD005 `<section>`'s `class` attribute to match. **Check the current state of this file first** — the sibling plan (`20260820_104832-qd005-aim-controls`) is mid-review and also owns this file; confirm the class name and section structure haven't changed since this ticket was written, and re-run that plan's tests/build if there's any overlap in your diff.
  - Add a new `<section class="boxed-section">` titled "Distance Sensor", placed immediately after `#movement-controls` and before the QD005 `<section>`. Inside: `#distance-sensor-controls` div containing `#distance-sensor-left-button` (`&#9664; Left`), `#distance-sensor-right-button` (`&#9654; Right`), `#distance-sensor-speed-select` (Fast/Slow options, Fast selected, mirroring `#aim-speed-select`), `#distance-sensor-angle-text` (`Distance Sensor: 90°`). All buttons/select start `disabled`, matching the Aim controls' initial markup.
  - Add CSS rules for the new ids/section, modeled directly on the existing `#aim-controls`/button/select/text rules (button layout, disabled styling, etc.).

**Blocked by:** 01 — needs `window.carAPI.setDistanceSensorAngle()` to exist.

**Status:** ready

- [x] `renderer.ts`: all state, constants, and handler functions added, mirroring Aim's shape
- [x] `renderDistanceSensor(state)` called from `render()`
- [x] Pointer event listeners wired for both buttons via `DISTANCE_SENSOR_BUTTON_IDS`
- [x] Speed-select change listener wired
- [x] `window.blur` handler calls `stopActiveDistanceSensor()`
- [x] `onStatus` handler resets `distanceSensorAngle` to 90 and stops the active hold at the correct transition points
- [x] `index.html`: `.qd005-section` renamed to `.boxed-section` (class + CSS rules), verified against sibling plan's current state
- [x] `index.html`: new "Distance Sensor" boxed section added after Movement, before QD005, with correct ids/glyphs/initial disabled state
- [x] CSS rules added for the new section/buttons/select/text
- [x] Manual verification: app builds and typechecks clean. **Note:** did not run a live browser/Playwright check against real hardware or a running Electron instance — no `renderer.test.ts`/DOM harness exists for this file (confirmed by checking for one; none found, matching Aim's own precedent of zero direct renderer.ts unit tests), and firmware has no handler for device code 0x04 yet (per CONTEXT.md gotcha), so there is nothing live to click-verify end-to-end yet. Visual/DOM structure was verified by reading the rendered `index.html` output directly instead.
- [x] `npm test`, `npm run typecheck`, `npm run build` all pass inside `app/` (265 tests passing, typecheck clean, build clean)
