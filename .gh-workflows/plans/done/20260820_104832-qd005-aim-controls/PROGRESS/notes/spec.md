# Session end-state: spec phase

## What happened this session

Read CONTEXT.md, grill/requirements.md, grill/decisions.md, grill/glossary.md. No ADR needed for this plan (confirmed in decisions.md — pure rename, no architectural decision required). Confirmed the current `app/public/index.html` structure directly (top-level divs `#light-controls`, `#movement-controls`, `#pan-controls`, `#shoot-controls`, `#log-panels`, and the existing `.log-panel-container` boxed CSS pattern) to ground the Implementation Decisions section precisely. Also read the prior `water-gun-fix-and-rotation` plan's `tickets/01-pan-rename.md` for the precedent pattern of doing a full-stack identifier rename as one atomic non-expand-contract batch.

Wrote `.gh-workflows/plans/20260820_104832-qd005-aim-controls/spec.md` using the standard template (Problem Statement, Solution, User Stories, Implementation Decisions, Testing Decisions, Out of Scope, Further Notes).

## Draft ticket breakdown

**Ticket 1 — Full Pan→Aim rename across the entire stack**
- Blocked by: none
- Delivers: the complete identifier/label rename applied atomically across every layer in one batch (mirroring the prior `01-pan-rename.md` precedent): `app/src/commandFrame.ts` (doc comment), `app/src/connectionUiState.ts` + `connectionUiState.test.ts`, `app/src/ipcChannels.ts` (including the wire string value `"car:set-pan-angle"` → `"car:set-aim-angle"`, no compat concern — internal-only channel), `app/src/preload.ts`, `app/src/main.ts`, `app/src/carIpcHandlers.ts` + `carIpcHandlers.test.ts`, `app/src/carConnection.ts` + `carConnection.test.ts`, `app/src/renderer.ts`, and `app/public/index.html` (ids `#pan-controls`/`#pan-left-button`/`#pan-right-button`/`#pan-speed-select`/`#pan-angle-text` → `aim-*` equivalents, CSS selectors renamed, button glyphs `&#9664;`/`&#9654;` → `&#9650;`/`&#9660;`, label text "Pan: 90°" → "Aim: 90°"). Direction-sign delta-map (`{up:1, down:-1}`) flagged unverified in a code comment. `#pan-controls` stays a standalone div at this ticket (not yet wrapped into the new QD005 section — that's Ticket 2). Zero leftover `pan`/`Pan`/`PAN` references in `app/src/` or `app/public/index.html`. `npm test`, `npm run typecheck`, `npm run build` all pass.

**Ticket 2 — New "QD005 Water Gun" boxed section**
- Blocked by: Ticket 1 (needs the renamed `aim-*` ids/controls to exist before wrapping them)
- Delivers: `app/public/index.html` only — replace the (now renamed) standalone `#aim-controls` div and the `#shoot-controls` div with one new wrapping `<section>` (or similar semantic element) titled "QD005 Water Gun", using new CSS (e.g. `.qd005-section`) modeled on the existing `.log-panel-container` bordered-box visual pattern (border, border-radius, padding, heading). Section occupies the exact same page position the two divs occupy today (after `#movement-controls`, before `#log-panels`). Shoot's ids/logic/handlers in `renderer.ts` are untouched — only its container changes. Verified via `npm run build`/`npm run typecheck` passing plus manual/visual inspection (no DOM test harness exists in this repo for `index.html`/`renderer.ts`).

Both tickets together satisfy the full spec. No prefactor tickets identified — this is a rename, not a feature requiring new abstractions.

## Next steps

Proceed to the tickets phase: get user approval on the spec/ticket breakdown, then write the actual ticket files under `.gh-workflows/plans/20260820_104832-qd005-aim-controls/tickets/` and add rows to `PROGRESS/INDEX.md`.
