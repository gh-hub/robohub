---
name: gh-dev-workflow/spec
description: Phase 2 of gh-dev-workflow. Synthesizes grill output into a spec and saves it to the plan folder. No user interview — pure synthesis.
---

# Spec Phase

## Purpose

Turn the grill output into a structured spec. No interview — synthesize what the grill already captured.

## Process

### 1. Load context

Read `PROGRESS/INDEX.md` first. Confirm the current phase is `spec`. If PROGRESS/INDEX.md says a different phase, stop and tell the user — do not proceed.

If the `spec` row's `Started` column is still empty, stamp it now with the current timestamp (`date +"%Y-%m-%d %H:%M:%S"`) and set its status to `in-progress` — a direct quick edit, not delegated. Leave it untouched if already set (a resumed session).

### 2. Delegate synthesis and write-up

Nothing in this phase needs the user — it's pure synthesis of grill output. Per the Delegation discipline in `SKILL.md`: if you're running this phase live (in conversation with the user), hand the rest of this phase to a fresh sub-agent (`Agent` tool, `general-purpose` type, not `fork`). If you were yourself spawned as a sub-agent to run this whole phase (e.g. under auto mode), just do the following steps directly instead of spawning yet another sub-agent.

Whoever does the work (you or the sub-agent) should:

1. Read `.gh-workflows/plans/{folder}/CONTEXT.md`, `.gh-workflows/plans/{folder}/grill/requirements.md`, `.gh-workflows/plans/{folder}/grill/decisions.md`, `.gh-workflows/plans/{folder}/grill/glossary.md`, and any ADRs in `.gh-workflows/plans/{folder}/grill/`. Not ask the user questions — if something is genuinely ambiguous and cannot be resolved from the grill output, note it in the spec under "Further Notes" as an open question.
2. If `requirements.md` has an "## Environment notes" section, treat those facts as already confirmed — don't re-explore or re-verify them. Explore the codebase (if one exists) for whatever the area being changed still needs beyond what that section already covers. Use the domain glossary vocabulary throughout the spec.
3. Identify test seams: sketch the seams at which the feature will be tested. Prefer existing seams. Use the highest seam possible. Propose new seams only if no existing one fits, and at the highest point available.
4. Write the spec to `.gh-workflows/plans/{folder}/spec.md` using the template below.
5. Using the spec just written, draft a ticket breakdown the same way `phases/tickets.md` steps 2-3 describe:
   - Look for prefactor opportunities first ("make the change easy, then make the easy change") — these tickets go first.
   - Slice the remaining feature into vertical slices: each a narrow but complete path through every layer (schema, API, UI, tests), independently demoable, sized to fit one implement session. Give each ticket its blocking edges.
   - Wide mechanical refactors (rename a column, retype a shared symbol) use expand-contract, one batch per ticket, per the "Wide refactors are the exception" note in `tickets.md`.
   - For each ticket, capture: title, blocked-by, and what it delivers end-to-end. This is a **draft only** — do not write anything under `.gh-workflows/plans/{folder}/tickets/`, and do not add ticket rows to `PROGRESS/INDEX.md`. That still happens in the tickets phase, after user approval.
6. Update `PROGRESS/INDEX.md` first: mark `spec` `done` in the Phases table, stamping `Finished` with the current timestamp (`date +"%Y-%m-%d %H:%M:%S"`), set current phase to `tickets`, point "Last session end-state" at `notes/spec.md`. Write `PROGRESS/notes/spec.md` with the session end-state, including a `## Draft ticket breakdown` section listing the drafted tickets (title / blocked-by / what it delivers), so the breakdown survives the session boundary between spec and tickets phases. Then update `CONTEXT.md`: add link to spec.md, set current phase to `tickets`. Then update `INDEX.md`: add link to spec.md, update status to `tickets`.

If delegating, give the sub-agent the plan folder path and these instructions verbatim — including the draft-ticket-breakdown step and the `PROGRESS/notes/spec.md` section requirement — plus: never run `git commit`/`git push`, never ask the user anything, and report back one line confirming what was written. Wait for it to finish before proceeding.

Spec template:

---

## Problem Statement

The problem that the user is facing, from the user's perspective.

## Solution

The solution to the problem, from the user's perspective.

## User Stories

A numbered list of user stories. Each in the format:

1. As a {actor}, I want {feature}, so that {benefit}

Be extensive — cover all aspects of the feature.

## Implementation Decisions

- Modules to build or modify
- Interface changes
- Technical clarifications
- Architectural decisions (reference ADRs where applicable)
- Schema changes
- API contracts
- Specific interactions

No file paths or code snippets unless a prototype produced a snippet that encodes a decision better than prose can.

## Testing Decisions

- What makes a good test for this feature (test external behavior, not internals)
- Which modules will be tested
- Prior art in the codebase for similar tests

## Out of Scope

What is explicitly not being built.

## Further Notes

Open questions, risks, or things to revisit.

---

### 3. Hand off

Tell the user: "Spec written. Start a new session and run `/gh-dev-workflow` to continue with the tickets phase." Mention they can also ask to run the rest autonomously (tickets, each implement ticket, review) — see "Auto mode" in `SKILL.md`; it still stops at the ticket-list checkpoint and any review checkpoint (pass, or round 3+ failure). Also mention that a draft ticket breakdown was written alongside the spec and will be presented for approval when the tickets phase starts.
