# Spec phase — session end-state

## What happened
Read CONTEXT.md, grill/requirements.md, grill/decisions.md, grill/glossary.md, and grill/ADR-001.md. No ambiguities required stopping — the grill output (interaction model, protocol, D-pad layout, interrupt semantics, gating, testing approach) was detailed enough to synthesize directly into spec.md with no user interview needed.

Explored the existing codebase beyond what the "Environment notes" section of requirements.md already covered: read every file under `app/src/` (`commandFrame.ts`, `carConnection.ts`, `ipcChannels.ts`, `carIpcHandlers.ts`, `preload.ts`, `renderer.ts`, `connectionUiState.ts`, `main.ts`) and `app/public/index.html`, plus all four existing test files (`commandFrame.test.ts`, `carConnection.test.ts`, `carIpcHandlers.test.ts`, `connectionUiState.test.ts`) to confirm the exact test-seam patterns (mock TCP server, `FakeCarConnection`, pure-function input/output pairs) already proven by the lights feature. Also peeked at the previous lights plan's ticket files (`.gh-workflows/plans/done/20260814_195843-car-lights-control/tickets/01-*.md`, `02-*.md`) to confirm ticket-granularity precedent: one ticket for the protocol/backend layer, one ticket for the full user-facing feature (UI + IPC + tests).

## Spec written
`.gh-workflows/plans/20260815_065830-car-movement-light-controls/spec.md` — Problem Statement, Solution, 16 user stories, Implementation Decisions (lights UI-only change; movement protocol/IPC/renderer changes per ADR-001), Testing Decisions (pure functions + mock TCP + FakeCarConnection tested; DOM wiring manually verified, per existing convention), Out of Scope, and Further Notes (live-hardware verification risk flagged, connection-drop-while-held edge case clarified as no new Stop-sending path).

## Test seams identified
All seams reuse the existing architecture proven by the lights feature — no new seams needed:
1. Pure function seam — `commandFrame.ts` (`buildCommandFrame` + new device/value constants for movement).
2. `CarConnection` seam — `setMovement()` tested against a mock TCP server (same pattern as `setLedState()`).
3. IPC handler seam — `handleSetMovement` tested via `FakeCarConnection` (same pattern as `handleSetLights`).
4. Renderer UI-state mapping seam — `mapMovementControlUiState` pure function (same pattern as `mapLightControlUiState`).
5. DOM/pointer-event wiring in `renderer.ts` — explicitly NOT unit tested (existing convention); manually verified against real hardware, with interrupt semantics flagged as the one must-test-manually scenario.

## Draft ticket breakdown

**01 — Lights: consolidate to a single button**
- Blocked by: none
- Delivers: `app/public/index.html`'s two `light-left-button`/`light-right-button` elements replaced with one `Lights` button; `renderer.ts`'s dual click listeners and `renderLights()` collapsed to one button's worth of wiring, still backed by the existing mirrored `lightsOn` boolean and `window.carAPI.setLights()`. No protocol/IPC/backend changes (nothing there needs to change). Independently demoable: click Lights, LED toggles, exactly as before but with one button.

**02 — Movement command-frame protocol layer on CarConnection**
- Blocked by: none (can proceed in parallel with 01)
- Delivers: `commandFrame.ts` gets `DEVICE_MOTOR = 0x0C` and a direction-to-value mapping (Stop/Forward/Backward/Left/Right/Rotate Left/Rotate Right); `carConnection.ts` gets `setMovement(direction)` mirroring `setLedState()`'s gating and rejection contract exactly. Pure-function tests for every direction's exact byte sequence (extending `commandFrame.test.ts`); mock-TCP-server tests for `setMovement()` covering every direction plus rejection when disconnected/http80 (extending `carConnection.test.ts`). Independently demoable/verifiable: unit tests pass, confirming wire bytes match ADR-001's device/value table for all seven values, without any UI yet.

**03 — Movement D-pad UI, IPC, and press-and-hold interaction**
- Blocked by: 02
- Delivers: the complete user-facing movement feature — `ipcChannels.ts`'s new `car:set-movement` channel; `carIpcHandlers.ts`'s `handleSetMovement` (extending `CarConnectionLike`); `preload.ts`'s `setMovement` exposure on `window.carAPI`; `connectionUiState.ts`'s `mapMovementControlUiState` pure gating function; `app/public/index.html`'s six D-pad buttons (cross layout + rotate row below); `renderer.ts`'s pointer event wiring (`pointerdown`/`pointerup`/`pointerleave`/`pointercancel`), `window.blur` handling, and `activeDirection` interrupt/matching state. FakeCarConnection-based IPC handler tests; pure-function UI-state-mapping tests. DOM wiring (pointer events, active-direction tracking, interrupt semantics) manually verified against hardware, per existing convention — interrupt semantics flagged as the required manual test case. Independently demoable: press-and-hold each direction button on real hardware, confirm motion starts/stops correctly including interrupt behavior.

Sequencing rationale: no prefactor tickets needed — `buildCommandFrame()`, `CarConnectionLike`, and the pure UI-state-mapping pattern were already built generically enough (per the previous plan's own stated intent) to extend directly. Ticket 01 is a trivial independent slice done first for a quick win. Tickets 02→03 mirror the previous plan's exact granularity (protocol/backend layer, then full UI/IPC feature) since movement is architecturally the same shape as lights was, just a new device code and six directions instead of one boolean.
