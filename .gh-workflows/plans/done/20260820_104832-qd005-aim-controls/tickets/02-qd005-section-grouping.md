# 02 — New "QD005 Water Gun" boxed section

**What to build:** from the user's perspective, the QD005 water-gun attachment's controls (Aim Up/Down + Shoot) now appear visually grouped together in their own clearly labeled, bordered section of the app, separate from the car's own Movement/Lights controls.

**Blocked by:** 01 — Full Pan→Aim rename across the entire stack

**Status:** ready

- [x] Create new semantic `<section>` element in `app/public/index.html` with title "QD005 Water Gun" (using an `<h2>` heading)
- [x] Move the renamed `#aim-controls` div (from Ticket 1) into the new section
- [x] Move the `#shoot-controls` div into the new section
- [x] Apply new CSS class (e.g. `.qd005-section`) to the section, modeled on existing `.log-panel-container` bordered-box visual pattern (border, border-radius, padding, heading spacing)
- [x] Verify section occupies the exact same page position as the two divs currently occupy (after `#movement-controls`, before `#log-panels`)
- [x] Confirm all Shoot button ids and renderer.ts event-handler logic remains completely untouched (only HTML container structure changes)
- [x] Run `npm run build` in `app/` directory and verify successful build
- [x] Run `npm run typecheck` in `app/` directory and verify no type errors
- [ ] Perform manual visual verification in the running app (note: no automated DOM/UI test harness exists in this repo for index.html/renderer.ts — visual verification is manual only) — NOT done by the agent; requires a human to run the app and look at it. Approximated instead by: reviewing the resulting HTML structure/nesting by re-reading the file (section correctly nests `#aim-controls` and `#shoot-controls`, sits between `#movement-controls` and `#log-panels`, no ids changed) and confirming `renderer.ts` contains no selector for `#aim-controls`/`#shoot-controls` that could break.
