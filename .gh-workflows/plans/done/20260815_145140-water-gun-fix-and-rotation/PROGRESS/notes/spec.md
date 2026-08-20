# Spec Phase End-State: water-gun-fix-and-rotation

## Session Summary

Pure synthesis session (no user interview) — read `CONTEXT.md` and all `grill/` output (`requirements.md`, `decisions.md`, `glossary.md`, `ADR-001.md`, `ADR-002.md`), cross-checked against the current shape of `app/src/commandFrame.ts`, `app/src/carConnection.ts`, `app/src/carIpcHandlers.ts`, `app/src/renderer.ts`, `app/src/connectionUiState.ts`, and `app/public/index.html`, then wrote `spec.md` at the plan root using the standard spec template.

## What was written

`spec.md` covers all three items from this plan:

1. **Pan rename (ADR-001):** Full rename mapping (types, state vars, constants, functions, HTML ids, labels) confirmed against current `renderer.ts`/`connectionUiState.ts`/`index.html` source — including the exact current `AimDirection`, `AIM_*` constant names, `mapAimControlUiState()`'s `upDisabled`/`downDisabled` shape, and current HTML ids (`#aim-controls`, `#aim-up-button`, `#aim-down-button`, `#aim-speed-select`, `#aim-angle-text`). One open call flagged in Further Notes: `window.carAPI.setAimAngle` (the IPC method/channel name) is deliberately left unrenamed per ADR-001's literal scope (UI labels/identifiers only, not IPC), since renaming it would ripple into `preload.ts`/`main.ts`/`ipcChannels.ts` for a cosmetic-only change.
2. **Discrete rotate buttons (ADR-002):** New `ROTATE_90_MS`/`ROTATE_180_MS` placeholder constants, new `rotateCooldownActive` state mirroring the existing `shootCooldownActive` pattern but disabling the *entire* movement/rotate button set (not just one button), new `handleDiscreteRotate()` composing the already-existing `stopActiveMovement()`/`sendMovement()` — no new protocol/device/IPC code needed, since `rotate-left`/`rotate-right`/`stop` already exist in `MOVEMENT_VALUES`. Also specified: the connection-drop and window-blur safety nets in `renderer.ts` need to additionally clear any in-flight discrete-rotate timer/cooldown, matching the existing pattern already there for movement/pan.
3. **Shoot diagnosis:** Documented as no-code-change, per decisions.md D3 — explicitly called out in spec.md's Solution and Out of Scope sections that no ticket is needed for this item.

Test seams identified: reuse existing precedent exactly — `mapPanControlUiState()` (renamed from `mapAimControlUiState()`) unit-tested directly in `connectionUiState.test.ts` (confirmed the current file already has a full angle-bound test suite at lines ~155-186 that needs renaming); no new `carIpcHandlers.test.ts`/`carConnection.test.ts` coverage needed since neither change adds new IPC surface (rotate buttons reuse the already-parametrized `rotate-left`/`rotate-right` cases in `handleSetMovement`'s tests, and `setAimAngle` is unchanged); confirmed no `renderer.test.ts` exists in the repo (`app/src/` glob checked directly), so `renderer.ts` DOM wiring stays untested for both changes, following existing precedent rather than introducing new test infrastructure.

## Draft ticket breakdown

Drafted per `phases/tickets.md` steps 2-3 (prefactor first, then vertical slices, blocking edges noted). **Draft only** — nothing written under `tickets/`, no rows added to `PROGRESS/INDEX.md`. Final ticket-writing happens in the tickets phase after user approval.

1. **Ticket: Pan rename (Aim → Pan)**
   - Blocked by: none.
   - Delivers: Full end-to-end rename of the Aim Up/Down control to Pan Left/Right — `AimDirection` type and all related constants/state/functions in `app/src/renderer.ts`; `mapAimControlUiState()` → `mapPanControlUiState()` (and its `upDisabled`/`downDisabled` → `leftDisabled`/`rightDisabled` shape) in `app/src/connectionUiState.ts`; HTML ids/labels/CSS selectors in `app/public/index.html`; and the corresponding renamed/updated test cases in `connectionUiState.test.ts`. No behavior change — mechanics (bounds, speeds, repeat interval, gating) stay identical, verified by the renamed tests passing with equivalent assertions. Independently demoable: open the app, see "Pan Left"/"Pan Right" buttons that behave exactly as the old Aim buttons did.

2. **Ticket: Discrete rotate buttons**
   - Blocked by: none (touches a different UI section — D-pad/rotate row — than the Pan rename's aim-controls section).
   - Delivers: Four new one-click buttons (`#rotate-90-left-button`, `#rotate-90-right-button`, `#rotate-180-left-button`, `#rotate-180-right-button`) in a new `.dpad-discrete-rotate-row` in `app/public/index.html`; `ROTATE_90_MS`/`ROTATE_180_MS` placeholder constants, `rotateCooldownActive` state, `handleDiscreteRotate()` handler, and updated disable/enable wiring across all movement/rotate buttons (continuous + discrete) in `app/src/renderer.ts`; connection-drop and window-blur safety-net updates to clear an in-flight rotate cooldown. Independently demoable: click a discrete rotate button, see the car spin briefly and stop, with all movement buttons disabled during the pulse.
   - **Coordination note (not a hard block):** both this ticket and the Pan rename ticket touch `app/src/renderer.ts`, but in disjoint regions (Pan's aim-related code vs. this ticket's movement/rotate-related code) — noted so whoever implements second rebases cleanly, not because either is blocked on the other.

3. **No ticket — Shoot hardware diagnosis:** Per decisions.md D3 and spec.md's Solution/Out of Scope sections, the Shoot finding is diagnosis-only (already fully captured in `grill/decisions.md`) and requires no code change, so no ticket is drafted for it. Called out explicitly here so it isn't silently dropped from the plan's three original issues.

## Next Phase: Tickets

The tickets phase will present the draft breakdown above for user approval, then write the two tickets under `tickets/` and add their rows to `PROGRESS/INDEX.md`.

## Session End Time

Spec phase completed: 2026-08-15 15:04:00
