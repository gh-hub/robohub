---
name: gh-dev-workflow/grill
description: Phase 1 of gh-dev-workflow. Grills the user to extract all requirements and decisions, then saves structured output to the plan folder.
---

# Grill Phase

## Purpose

Extract a complete, unambiguous picture of what we're building. This is the only phase where the user is fully interactive. Everything downstream (spec, tickets, code) builds on this output — get it right here.

## Process

### 1. Load context

Read `PROGRESS/INDEX.md` first. Confirm the current phase is `grill`. If PROGRESS/INDEX.md says a different phase, stop and tell the user — do not proceed.

If the `grill` row's `Started` column is still empty, stamp it now with the current timestamp (`date +"%Y-%m-%d %H:%M:%S"`) and set its status to `in-progress` — a direct quick edit, not delegated. Leave it untouched if already set (a resumed session).

Read `CONTEXT.md`. If this is the first session, it will be sparse — that's expected.

If the repo has a domain glossary or ADRs, read them now so you use consistent vocabulary.

### 2. Run the interview

Follow the grilling discipline from `phases/grilling.md`:

- Interview relentlessly, one question at a time
- Walk every branch of the decision tree
- For each question, give your recommended answer first
- Look up facts from the environment rather than asking about them
- Do not proceed until the user confirms shared understanding

Focus areas:
- **What problem are we solving?** From the user's perspective.
- **Who are the actors?** Who uses this, who is affected.
- **What does done look like?** Concrete, observable outcomes.
- **What are the boundaries?** What is explicitly out of scope.
- **What constraints exist?** Tech stack, performance, compliance, backwards compat.
- **What decisions are already made?** Don't re-litigate them — record them.
- **What is unknown or risky?** Surface it now, not during implement.

### 3. Confirm shared understanding

Before saving anything, summarize what you've heard and ask the user to confirm. Fix anything that's off.

### 4. Delegate the write-up

The interview is over — nothing from here on needs the user, so hand the write-up to a subagent (`Agent` tool, `general-purpose` type, not `fork`: it needs none of your conversation history, only the confirmed material below; `model: haiku` — the content below is already decided, this step only transcribes it into files) instead of writing the files yourself. This keeps the formatting/tool-call noise out of your context.

Give it a self-contained prompt with everything gathered in the interview — problem, actors, done criteria, boundaries, constraints, each confirmed decision (with reasoning and rejected alternatives), glossary terms, which decisions have lasting architectural consequences, and any codebase facts you looked up during the interview (per `grilling.md`'s "look up facts from the environment" discipline) — plus these instructions:

Write to `.gh-workflows/plans/{folder}/grill/`:

- **requirements.md** — what we're building, written from the user's perspective. Not a spec, not a design. Just: what problem, what solution, what done looks like, what's out of scope. If any codebase facts were looked up during the interview, add an "## Environment notes" section listing them — this lets the spec phase skip re-confirming what's already known. Omit the section entirely if the interview didn't require any environment lookups.
- **decisions.md** — every load-bearing decision made during the interview. Format:
  ```
  ## Decision: {title}
  Decided: {what was decided}
  Why: {reason given}
  Alternatives rejected: {if any}
  ```
- **glossary.md** — domain terms defined or clarified during the session. One term per entry.
- **ADR-NNN.md** — one file per architectural decision that has lasting consequences (tech choice, schema shape, API contract, integration approach). Only for decisions the team will need to remember in 6 months.

Then update the plan files:

- `PROGRESS/INDEX.md`: mark `grill` `done` in the Phases table, stamping `Finished` with the current timestamp (`date +"%Y-%m-%d %H:%M:%S"`), set current phase to `spec`, point "Last session end-state" at the new notes file below.
- `PROGRESS/notes/grill.md`: the session end-state — what was gathered, what's next.
- `CONTEXT.md`: fill in "What we're building" (one sentence), add key decisions (one line each, link to ADR if one exists), set current phase to `spec`, clear "Load this session" (that's for implement/review sessions).
- `INDEX.md`: fill in "What we're building", update status to `spec`.

Tell it never to run `git commit`/`git push`, and to report back one line confirming what was written.

Wait for the subagent to finish before proceeding.

### 5. Hand off

Tell the user: "Grill complete. Start a new session and run `/gh-dev-workflow` to continue with the spec phase." Mention they can also ask to run everything from here on autonomously (spec, tickets, each implement ticket, review) — see "Auto mode" in `SKILL.md`; it still stops at the ticket-list checkpoint and any review checkpoint (pass, or round 3+ failure).
