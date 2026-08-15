---
name: gh-dev-quick-workflow
description: Lightweight sibling of gh-dev-workflow for tasks that fit in 1-2 tickets. Same plan folder, same grill/implement/review rigor — merges spec+tickets into one approval checkpoint and runs single-session by default. If the plan turns out to need 3+ tickets, offers to escalate to gh-dev-workflow (reusing grill/spec in place) or trim back down. Not for multi-session or multi-ticket features — use gh-dev-workflow for those.
---

# gh-dev-quick-workflow

For small, non-complex tasks: a bug fix, a small feature, a narrow refactor — the kind of thing that's clearly 1-2 tickets, not a multi-week feature. Reuses `gh-dev-workflow`'s plan folder, grill, implement, and review phases directly; only the spec+tickets step is unique to this skill.

If a task turns out to be bigger than 1-2 tickets once it's actually scoped, this skill escalates to `gh-dev-workflow` rather than forcing it — see "Ticket cap and escalation" below.

## First invocation (no plan exists yet)

If invoked without a plan argument, derive a short, slug-friendly name from what the user described (e.g. `fix-null-check`) and proceed — do not ask the user to name it. Mention the chosen name in passing so they can redirect if they'd prefer a different one.

Delegate creating the plan folder: spawn a fresh `general-purpose` sub-agent (via the `Agent` tool, not `fork`, `model: haiku` — pure template fill-in, no judgment) telling it to create

```
.gh-workflows/plans/YYYYMMDD_HHMMSS-{name}/
  INDEX.md
  CONTEXT.md
  PROGRESS/
    INDEX.md
```

using the templates in `../gh-dev-workflow/plan-structure.md` (`Workflow: quick`, not `full`, in both `INDEX.md` and `PROGRESS/INDEX.md` — this is the one field this skill sets differently from the template default), with the timestamp taken from `date +%Y%m%d_%H%M%S` run at creation time. `.gh-workflows/plans/` always lives at the project's repository root — same rules as `gh-dev-workflow` (never nested under a subdirectory, even in a monorepo). This is the *same* plans root `gh-dev-workflow` uses — a quick-plan and a full plan live side by side and are structurally interchangeable. Have it report back the exact folder path it created. Then begin the **grill phase** by reading `../gh-dev-workflow/phases/grill.md` and following it (see "Adapting referenced phase files" below).

## Resuming a plan

If a plan name or path is given as an argument, read that plan's `PROGRESS/INDEX.md` and continue from the current phase.

If no argument is given and multiple plans exist, list them and ask which to resume — read each candidate's `PROGRESS/INDEX.md` `Workflow` field and show it alongside the plan name so the user can tell quick plans from full ones at a glance.

Once the plan is identified, read `PROGRESS/INDEX.md` and check `Workflow`:

- If it says `full` — this plan already escalated to `gh-dev-workflow` (or was never a quick plan to begin with). Stop and tell the user: "This plan is running under `gh-dev-workflow` — run `/gh-dev-workflow` to continue it." Do not run this skill's own phases against it.
- If it says `quick` (or the field is absent, for plans created before this field existed — treat that as `quick` only if the plan's own history shows it came from this skill, otherwise ask), determine the current phase and read the matching phase file per "Phase sequence" below.

## Phase sequence

```
grill        → ../gh-dev-workflow/phases/grill.md        (referenced directly, unmodified)
spec+tickets → phases/spec-tickets.md                     (this skill's own — covers both the `spec` and `tickets` phase-table rows in one sitting)
implement    → ../gh-dev-workflow/phases/implement.md     (referenced directly, unmodified; one session's worth of work per ticket)
review       → ../gh-dev-workflow/phases/review.md        (referenced directly, unmodified; spec-match + security + lint/build/test/e2e gate)
```

Phase-table strings in `PROGRESS/INDEX.md` are identical to `gh-dev-workflow`'s (`grill`, `spec`, `tickets`, `implement/{slug}`, `review/round-{N}`) — this is what makes a quick-plan and a full plan interchangeable. For a phase string with a suffix (`implement/{slug}`, `review/round-{N}`), the file is picked from the prefix before the slash.

## Adapting referenced phase files

`grill.md`, `implement.md`, and `review.md` are read from `gh-dev-workflow`'s folder verbatim — they were written for that skill, so two adaptations apply whenever you follow one of them under this skill:

1. **Resolve their internal paths against `gh-dev-workflow`, not this skill.** When one of these files mentions a path relative to "this skill's folder" (e.g. `phases/grilling.md`, `coding-rules/INDEX.md`), that always means `../gh-dev-workflow/phases/grilling.md`, `../gh-dev-workflow/coding-rules/INDEX.md` — never a path under `gh-dev-quick-workflow/` itself, since those files don't exist here.
2. **Ignore their "hand off" step's session-restart wording; substitute this skill's own session model.** Lines like *"Start a new session and run `/gh-dev-workflow` to continue"* assume `gh-dev-workflow`'s default multi-session model, which this skill doesn't use (see "Session model" below). Wherever a referenced file's final hand-off step tells the user to start a new session, do this instead:
   - If nothing needs the user (the next phase is fully delegable): don't stop at all — proceed straight into the next phase in the same turn (delegating its mechanical work per usual), after a one-line status update in narration mode (see "Progress narration" below), or silently in a suppressed-narration run.
   - If a real checkpoint follows (ticket approval, review pass, round 3+ decision): stop and surface that checkpoint exactly as the file describes — this part of their wording is unaffected.
3. **These files are always run "live."** Where a referenced file offers a branch for "if you were yourself spawned as a sub-agent to run this whole phase, skip the extra hop" — that branch never applies here. This skill's conductor is always the live session in conversation with the user; it never spawns itself away to run a whole phase unattended. Always take the "running this phase live" branch, which delegates only the phase's mechanical tail to a fresh sub-agent.

## Ticket cap and escalation

The defining constraint of this skill: the initial plan is capped at **1-2 tickets**, decided during the spec+tickets phase (`phases/spec-tickets.md`). This is what "small, non-complex" means here — an objective, checkable signal instead of a vibe.

If drafting the ticket breakdown comes out to 3+ tickets, the phase always stops and asks the user live — regardless of the progress-narration toggle below — offering exactly two options, no silent override:

- **escalate** — hand the plan to `gh-dev-workflow`, reusing the grill output and drafted spec in place (no lost work). Mechanics are in `phases/spec-tickets.md`.
- **trim** — consolidate the breakdown back to 1-2 tickets, if that's still an honest shape (not forced if it would weld two unrelated pieces of work into one ticket).

This cap applies **only** to the initial breakdown. Review-round fix tickets are never capped and never trigger an escalation offer, however many findings come back — see `phases/spec-tickets.md` and `../gh-dev-workflow/phases/review.md` for why.

## Session model

Runs single-session by default: no "start a new session" hand-offs between phases. The current session acts as its own conductor — it delegates each phase's mechanical work (write-ups, ticket implementation) to a fresh sub-agent per the Delegation discipline below, waits for it, then keeps going — stopping only at genuine checkpoints (grill answers, the combined spec+tickets approval or escalate/trim decision, review pass, round 3+ continue/stop). `PROGRESS/INDEX.md` is still written after every phase, so an interrupted session can resume cleanly — that's a safety net, not the expected path.

There is no separate "auto mode" the way `gh-dev-workflow` has one — the behavior above is simply how this skill always runs. The only thing that toggles is narration verbosity:

## Progress narration

Two modes, chosen by how the user invokes this skill (default, or explicitly asking to run it quietly / `--auto`):

- **Default**: pause briefly after each phase completes to report what happened before continuing (e.g. "Grill complete — moving to spec+tickets," "Ticket 1 of 2 done — starting ticket 2"). These are visibility pauses, not decision points — nothing to reply to, just a moment to notice and redirect if something looks off.
- **Quiet / `--auto`**: skip those pauses; run straight through non-checkpoint phases with just a one-line status per phase.

Neither mode changes what counts as a checkpoint. The escalate/trim decision (see above) and every checkpoint listed under "User checkpoints" always stop live in both modes — narration verbosity never resolves a judgment call on the user's behalf.

## User checkpoints

The user is active at these points:

1. **Grill**: fully interactive — you answer every question
2. **Spec + tickets**: approve the combined breakdown, or resolve the escalate/trim decision if 3+ tickets were needed
3. **Review, on pass**: reply "done" to archive
4. **Review, round 3+ on failure**: reply "continue" or "stop"

A `review` failure at round 1 or 2 needs no user input — it auto-loops back to `implement`. Everything else runs autonomously within the same session.

## Delegation discipline

Every phase's mechanical write-up (writing files, updating `PROGRESS/INDEX.md`, `PROGRESS/notes/{phase-slug}.md`, `CONTEXT.md`/`INDEX.md`) is delegated to a fresh `general-purpose` sub-agent once no further user input is needed for that step — same pattern `gh-dev-workflow` uses, and the reason "single session" is viable at all: it keeps tool-call noise and file-exploration output out of the conductor's own context. This applies uniformly here (no live/spawned-sub-agent branching — see "Adapting referenced phase files" point 3).

## Source of truth

**PROGRESS/INDEX.md is always the source of truth for phase and ticket state.** Same rule as `gh-dev-workflow` — `CONTEXT.md` and `INDEX.md` are derived views; `PROGRESS/notes/` files are historical write-ups, never state.

## Reference

See `../gh-dev-workflow/plan-structure.md` for the canonical definition of every file and folder in a plan — this skill uses the identical structure, with two deltas:

1. `spec.md` omits the **User Stories** section (Problem Statement, Solution, Implementation Decisions, Testing Decisions, Out of Scope, Further Notes only) — see `phases/spec-tickets.md` for the template.
2. The initial ticket breakdown is capped at 1-2 tickets, enforced during the spec+tickets phase itself, not by the plan structure.

Coding rules are loaded exactly as `../gh-dev-workflow/phases/implement.md` and `../gh-dev-workflow/phases/review.md` already specify (they point at `gh-dev-workflow`'s own `coding-rules/` folder by name) — no separate coding-rules setup needed for this skill.
