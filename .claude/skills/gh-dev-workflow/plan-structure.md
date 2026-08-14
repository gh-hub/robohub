# Plan Structure

Canonical definition of every file and folder inside a plan.

## Folder layout

```
.gh-workflows/plans/
  coding-rules/          ← optional, project-specific rules only; not auto-created
  tech-debt/              ← global backlog, one file per open DEBT item; written by the separate gh-codereview-workflow-test skill, not by gh-dev-workflow
    YYYYMMDD_HHMMSS-{slug}.md
  done/                  ← completed plans, moved here once review passes and the user confirms "done"
    YYYYMMDD_HHMMSS-{name}/
  YYYYMMDD_HHMMSS-{name}/  ← in-progress plans (only these show here)
```

Plans in `.gh-workflows/plans/` root are in-progress. When review passes and the user confirms, the plan moves to `.gh-workflows/plans/done/`. `coding-rules/` (if it exists) and `tech-debt/` stay at the root always. `tech-debt/` is gh-dev-workflow's neighbor, not its output — see the `gh-codereview-workflow-test` skill for how it's populated, and `gh-debt-workflow` for how it's triaged.

Not every plan here was created by gh-dev-workflow's own `grill` phase. `gh-codereview-workflow-test`'s `decide` phase can seed a plan directly at the `implement` phase — grill/spec/tickets marked skipped in `PROGRESS/INDEX.md`, `spec.md` framed as the review's findings, one ticket per BLOCK finding. Such a plan looks and resumes exactly like any other in-progress plan; there's nothing gh-dev-workflow needs to do differently.

## Plan folder name

`YYYYMMDD_HHMMSS-{name}/`

Timestamp is to-the-second so plans sort chronologically. Name is short and slug-friendly (e.g. `auth-refactor`, `user-dashboard`).

## Files

### INDEX.md

What this plan is and links to everything inside it. Written at plan creation, updated as phases complete. A human or fresh agent should be able to understand the full plan from this file in 30 seconds.

```markdown
# {Plan name}

## What we're building
One sentence.

## Status
Workflow: full
Current phase: grill

## Links
- [PROGRESS/](PROGRESS/INDEX.md)
- [CONTEXT.md](CONTEXT.md)
- [Grill output](grill/)
- [Spec](spec.md)
- [Tickets](tickets/)
- [Review](review/)
```

---

### CONTEXT.md

The session passport. A fresh session reads ONLY this file to get oriented — never the full grill output, never the full spec. Must stay under 1k tokens (~700 words). If it grows beyond that, it contains too much.

What belongs here:
- One sentence on what we're building
- Key decisions (load-bearing ones only — link to the ADR for detail)
- Current phase and ticket
- Exact file paths to load this session (ticket, rules files, etc.)
- Critical gotchas — facts that would cause a mistake if unknown

What does NOT belong here:
- Full conversation transcripts
- Full spec content (link to spec.md)
- Full ticket text (link to tickets/)
- Code snippets

Updated at the end of every session.

```markdown
# Context: {plan name}

## What we're building
One sentence.

## Key decisions
- Decision 1 — see grill/ADR-001.md
- Decision 2 — ...

## Current state
Phase: {current phase}
Completed tickets: {list or "none"}
Current ticket: {path or "none"}

## Load this session
- .gh-workflows/plans/{folder}/tickets/{current}.md
- coding-rules/{relevant}.md (skill defaults) + .gh-workflows/plans/coding-rules/{relevant}.md (project, if present)

## Gotchas
- Fact that would cause a mistake if unknown
```

---

### PROGRESS/

Machine-readable state tracker, as a folder rather than one file. The orchestrator reads `PROGRESS/INDEX.md` to know where to resume; the per-phase narrative that used to accumulate inline now lives one file per phase in `PROGRESS/notes/`, so `INDEX.md` stays a small, constant-size table no matter how many rounds/tickets a plan goes through.

```
PROGRESS/
  INDEX.md
  notes/
    grill.md
    spec.md
    tickets.md
    implement-01-{slug}.md
    implement-02-{slug}.md
    review-round-1.md
    ...
```

#### INDEX.md

```markdown
# Progress: {plan name}

## Workflow
full

## Current phase
grill

## Current ticket path
(none — set to full file path when an implement phase starts)

## Base branch
(none — set once, at the start of implement ticket 01)

## Phases
| Phase | Status | Started | Finished | Notes |
|---|---|---|---|---|
| grill | pending | | | |
| spec | pending | | | |
| tickets | pending | | | |
| implement/01-{slug} | pending | | | |
| implement/02-{slug} | pending | | | |
| review/round-1 | pending | | | |

## Last session end-state
Link to whichever `notes/` file was written most recently — no prose duplicated here.
```

`Current ticket path` holds the exact file path of the ticket being implemented (e.g. `.gh-workflows/plans/{folder}/tickets/01-auth.md` or `.gh-workflows/plans/{folder}/review/round-1/tickets/01-fix.md`). It is the authoritative source for which file implement.md loads. Updated by tickets.md and review.md whenever a new ticket becomes current; cleared when all tickets are done.

`Base branch` is set exactly once, by `implement.md` during ticket `01` (`git rev-parse --abbrev-ref HEAD`), and never touched again — it's what every review round diffs against (`git diff {base-branch}...HEAD`). If it's already set when a session reads this file, leave it alone.

`Workflow` records which skill is driving this plan: `full` for a plan created by (or escalated into) `gh-dev-workflow`, `quick` for one still owned by the separate `gh-dev-quick-workflow` skill. Set once at plan creation by whichever skill creates the folder, and flipped from `quick` to `full` exactly once — when a quick-plan escalates (see that skill's own docs). Never flips back. This is what lets either skill's "resuming a plan" step tell, without guessing from phase-table shape, whether a given plan folder is still its own to run.

`Started`/`Finished` record exactly when a phase's row was entered and completed, to the second (`date +"%Y-%m-%d %H:%M:%S"`). Status values: `pending` (not yet reached) → `in-progress` (a session has begun this row — `Started` gets stamped at this transition) → `done` (or `PASS`/`FAIL` for review rounds, `Finished` stamped at this transition). `Started` is set once, the first time a phase's session reads this file and finds that row still `pending`, and is never overwritten after that — even if the phase spans several resumed sessions (e.g. a ticket picked back up later). `Finished` is set once, when the row reaches its terminal status.

The `Phases` table is the single source of truth for both the checklist (what used to be `- [x] phase (date)` lines) and review-round outcomes (what used to be a separate `## Review rounds` section) — a review round's `Status` column holds `PASS`/`FAIL` directly, so there's no second place recording the same fact.

#### notes/{phase}.md

One file per row in the `Phases` table, written at the end of the session that completes that phase — this is where "what was done, what comes next" prose goes (what used to be appended inline as `## Last session end-state` / `## Previous session end-state (...)`, growing unboundedly). Only the file for the *current*/most-recent phase needs reading to resume; older ones are historical and are read only if someone is specifically digging into that phase's history.

**Filename**: take the phase string exactly as it appears in the `Phases` table, replace every `/` with `-`, append `.md`. Mechanical, no judgment call:
- `grill` → `notes/grill.md`
- `implement/01-schema-seed-data` → `notes/implement-01-schema-seed-data.md`
- `review/round-1` → `notes/review-round-1.md`
- `implement/review-round-1-fix-01-{slug}` → `notes/implement-review-round-1-fix-01-{slug}.md`

---

### grill/

Output from the grill phase. The spec reads from here.

```
grill/
  requirements.md    ← what we're building, from the user's perspective
  decisions.md       ← key decisions made during grilling
  glossary.md        ← domain terms agreed on
  ADR-001.md         ← one file per architectural decision record (if any)
```

---

### spec.md

Full spec in PRD format. Written by the spec phase from grill/ output. The tickets phase reads this.

---

### tickets/

One file per implementation ticket. Written by the tickets phase.

```
tickets/
  01-{slug}.md
  02-{slug}.md
  ...
```

Numbered from 01 in dependency order (blockers first).

---

### review/

One subfolder per review round, written by `phases/review.md` — a pass/fail gate, not a severity-tagged review. That fuller review (standards, code smells) lives in the separate `gh-codereview-workflow-test` skill and is not tied to a plan's folder structure at all.

```
review/
  round-1/
    findings.md      ← spec-match gaps + security findings + lint/build/test/e2e output (only written on failure)
    tickets/          ← one fix ticket per finding, tagged [spec]/[security] (only written on failure)
      01-{slug}.md
  round-2/
    ...
```

Round `N` **fails** when the diff doesn't fully satisfy `spec.md`, a sub-agent finds a concrete security vulnerability introduced by the diff, or lint, build, the unit/integration suite, or the e2e suite don't pass. On failure, `findings.md` and fix tickets are written; for rounds 1-2 the plan loops straight back to `implement` with no user checkpoint (this is an objective gate, not a judgment call). Round 3+ failures stop and ask the user to `continue` (round `N+1`) or `stop` (leave the plan in-progress).

Round `N` **passes** when the diff satisfies `spec.md`, no security findings are reported, and lint, build, unit/integration tests, and e2e tests (whichever of these exist in the project) are all green — no `findings.md`/`tickets/` are written for a passing round. The user then confirms `done` to archive the plan.

---

---

## .gh-workflows/plans/coding-rules/

The gh-dev-workflow skill ships its own default rules in `coding-rules/` inside the skill's folder (`general.md`, stack-specific files, and rows pointing at standalone skills like `nestjs-service-style`) — those apply to every project the skill is installed in and are never generated per-project.

`.gh-workflows/plans/coding-rules/` at the project root is the optional layer on top of that: project-specific rules only, things that are true of this one repo and don't belong in the shared skill defaults. It is **not** created automatically. Create it only when a rule actually needs recording — same lazy pattern as `.gh-workflows/plans/tech-debt/`. A project with no rule of its own simply has no `.gh-workflows/plans/coding-rules/` folder, and that's the expected state, not a missing setup step.

When a project-specific rule does come up, create `.gh-workflows/plans/coding-rules/INDEX.md`:

```markdown
# Coding Rules Index (project overrides)

Read alongside the gh-dev-workflow skill's own coding-rules/INDEX.md. Rules here add to or override the skill defaults where they conflict — only add a rule here if it's specific to this project.

## Rule files

| File | Load when |
|---|---|

<!-- Add a row here each time you create a rule file, e.g.:
| [payments-service.md](payments-service.md) | Ticket touches the payments service |
-->
```

Only list files that actually exist. Do not add rows for files that haven't been created yet — a missing file is worse than a missing row.
