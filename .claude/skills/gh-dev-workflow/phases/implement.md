---
name: gh-dev-workflow/implement
description: Phase 4 of gh-dev-workflow. Implements one ticket per session. No commits. Loads CONTEXT.md and relevant coding rules at start. Delegates the implementation to a sub-agent when run live; runs directly when already running as one.
---

# Implement Phase

## Purpose

Implement one ticket. One ticket = one session. Do not implement more than one ticket per session unless both are trivially small and you are confident you will stay well under 120k tokens total.

## Process

### 1. Load context

Read `.gh-workflows/plans/{folder}/PROGRESS/INDEX.md` first — source of truth. Confirm the current phase is an `implement/*` phase. If it is not, stop and tell the user — do not proceed. Take the ticket file path from the `Current ticket path` field.

If the current ticket's row `Started` column is still empty, stamp it now with the current timestamp (`date +"%Y-%m-%d %H:%M:%S"`) and set its status to `in-progress` — a direct quick edit, not delegated. Leave it untouched if already set (a resumed session).

### 2. Delegate the implementation

Nothing from here on needs the user — it's execution against an already-approved ticket. Per the Delegation discipline in `SKILL.md`: if you're running this phase live (in conversation with the user, e.g. a fresh session opened for this one ticket), hand the rest of this phase to a fresh sub-agent (`Agent` tool, `general-purpose` type, not `fork`). If you were yourself spawned as a sub-agent to run this whole phase (e.g. under auto mode), just do the following steps directly instead of spawning yet another sub-agent.

Whoever does the work (you or the sub-agent) should:

1. Read `.gh-workflows/plans/{folder}/CONTEXT.md` for orientation. If "Current ticket" there disagrees with `Current ticket path` from PROGRESS/INDEX.md, PROGRESS/INDEX.md wins — correct CONTEXT.md before continuing. If this is ticket `01` and `PROGRESS/INDEX.md`'s `Base branch` field is still empty, run `git rev-parse --abbrev-ref HEAD` and write the result there now — this is the only ticket that sets it. Every later ticket leaves it untouched.
2. Read the ticket file at the path from PROGRESS/INDEX.md's `Current ticket path` field. Do not construct this path yourself — it may be under `tickets/` for original work or `review/round-N/tickets/` for review fixes.
3. Read `coding-rules/INDEX.md` (in the gh-dev-workflow skill's own folder — shipped defaults) and `.gh-workflows/plans/coding-rules/INDEX.md` if it exists in this project (project-specific overrides). From both, load only the rule files that apply to this ticket's tech stack — a `file` row is read directly, a `skill` row (e.g. `nestjs-service-style`) is invoked with the `Skill` tool, not just read. Do not read the full spec or grill output unless CONTEXT.md links to something specific needed.
4. Explore only the code relevant to this ticket, guided by its acceptance criteria. Do not explore the whole codebase.
5. Implement using TDD, test-first where possible: write a failing test at the agreed seam (from the spec's testing decisions), make it pass, run typechecking after each meaningful change, run the single test file regularly, run the full test suite once at the end. Use the coding rules loaded above. If a rule conflicts with good judgment, note the conflict in this ticket's `PROGRESS/notes/` file (below) — do not silently break the rule.
6. Do NOT run `git commit` or `git add` for a commit. The user commits.
7. Edit the ticket file at the path from step 2, checking off each acceptance criterion (`- [x]`) — or note if something is partial and why.
8. Update `PROGRESS/INDEX.md` first: mark this ticket's row `done` in the Phases table, stamping `Finished` with the current timestamp (`date +"%Y-%m-%d %H:%M:%S"`); set current phase to the next ticket slug, or — if all tickets done — the next review phase (all *original* tickets done, no review round started yet → `review/round-1`; all tickets in `review/round-{N}/tickets/` done → `review/round-{N+1}`); set `Current ticket path` to the full path of the next ticket, or `(none)` if all tickets done; point "Last session end-state" at this ticket's new notes file (`PROGRESS/notes/implement-{NN}-{slug}.md`, or `PROGRESS/notes/implement-review-round-{N}-fix-{NN}-{slug}.md` for a review fix ticket). Write that notes file with what was built and what the next session needs to know. Then update `CONTEXT.md`: move completed ticket to "Completed tickets", set current ticket to the full path of the next ticket (or "none" if all done), update "Load this session" for the next session, add any gotchas discovered during implementation.

If delegating, give the sub-agent the plan folder path and these instructions verbatim, plus: never run `git commit`/`git push`, never ask the user anything (make the reasonable call and note ambiguities in the plan files instead of stopping), and report back one line: what was built and the new current phase. Wait for it to finish before proceeding.

### 3. Hand off

If more tickets remain: "Ticket {N} done. Start a new session and run `/gh-dev-workflow` to implement ticket {N+1}." Mention they can also ask to run the rest autonomously (remaining tickets and review) — see "Auto mode" in `SKILL.md`; it still stops at any review checkpoint (pass, or round 3+ failure).

If all tickets are done: "All tickets implemented. Start a new session and run `/gh-dev-workflow` to begin review (spec match + build/test)."
