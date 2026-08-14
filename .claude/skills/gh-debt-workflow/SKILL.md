---
name: gh-debt-workflow
description: Reviews the global tech-debt backlog at .gh-workflows/plans/tech-debt/ (populated by gh-codereview-workflow-test's review phase as DEBT findings are logged). Checks each item for continued relevance, discards stale ones, and — for whatever remains — starts a new gh-dev-workflow plan to fix it, using the surviving debt files as that plan's context. Run standalone via /gh-debt-workflow.
---

# gh-debt-workflow

## Ownership

`gh-codereview-workflow-test` writes to `.gh-workflows/plans/tech-debt/` (its review phase, as soon as a DEBT finding is logged) and never reads it back. This skill is the only reader: it decides what's still worth fixing, and starts the `gh-dev-workflow` plan that fixes it. Neither `gh-codereview-workflow-test` nor `gh-dev-workflow` carries any reference to this skill — the three connect only through the folder on disk.

## Process

### 1. Load the backlog

List every file in `.gh-workflows/plans/tech-debt/*.md`. If none exist, say so and stop.

### 2. Check relevance — before anything else

For each file, verify the finding is still real by looking at the current codebase, not just trusting the file's age:
- Does the file/area it names still exist, in roughly the shape described?
- Has it already been fixed by other work since the finding was logged?
- Is it a duplicate of another backlog item (same root cause, already covered)?

Do this check for every item before moving any of them forward — relevance is decided up front, not discovered mid-plan.

- **No longer relevant** (fixed elsewhere, code removed, stale, duplicate) → delete the file. Note briefly why.
- **Still relevant** → keep for step 3.

### 3. Stop if nothing survived

If every item was discarded in step 2, report what was deleted and why, and stop. Do not start a plan for zero items.

### 4. Start a gh-dev-workflow plan for what remains

Invoke the `gh-dev-workflow` skill to start a new plan dedicated to fixing the surviving debt items — not folded into an unrelated feature plan. Pick a plan name that reflects the theme (e.g. `tech-debt-cleanup`, or something sharper if the surviving items share a clear focus).

Pass the full content of every surviving debt file as context for the grill phase — these findings already describe what's wrong and why; grill should confirm scope with the user quickly rather than starting cold.

Once an item's content has been carried into the new plan (past the grill's save-output step), delete its file from `.gh-workflows/plans/tech-debt/` — it's now owned by that plan, not the backlog.

### 5. Hand off

Report: N discarded (with reasons), N carried into the new plan, and the new plan's folder name. If the new plan's grill phase actually started, say so — that session continues from there per `gh-dev-workflow`'s normal phase sequence.
