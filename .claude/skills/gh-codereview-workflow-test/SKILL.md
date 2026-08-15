---
name: gh-codereview-workflow-test
description: Standalone code-quality review of everything changed in the current branch — Standards + code-smell baseline only, not spec/business-logic matching (gh-dev-workflow's review phase handles that). Diffs against the base branch, reviews changed files in batches (one read-only sub-agent per batch), synthesizes a summary, and — on a live checkpoint — hands BLOCK findings to a fresh gh-dev-workflow plan for actual fixing. This skill itself never edits code. Reads STATE.md to resume from any phase.
---

# gh-codereview-workflow-test

Reviews all changes currently different from the base branch, purely as code: does it follow the coding standards, is it free of the standard smells. It never checks whether the code matches a plan, spec, or ticket — that judgment belongs to `gh-dev-workflow`'s `review` phase, which runs during implementation and has the spec to check against. This skill runs independently of any plan, any time you want a standards pass over the branch — mid-feature, before opening a PR, or after `/gh-dev-workflow` finishes.

**Code only, not docs.** Documentation and prose (`*.md`, `*.mdx`, `*.txt`, `*.rst`) are excluded from review — this skill checks coding standards and code smells, never doc content.

**This skill never changes business logic.** Every review sub-agent is read-only — it may only write its own report file, never edit the code it's reviewing. If BLOCK findings need fixing, this skill hands them off to a fresh `gh-dev-workflow` plan; `gh-dev-workflow`'s `implement` phase does the actual editing, gated by its own spec-match/build/test review afterward.

## First invocation

Determine the current branch name (`git branch --show-current`) and slugify it (lowercase, non-alphanumerics to `-`) for the folder name. Determine the base branch — try `git merge-base --fork-point` against the repo's default branch first; if that's ambiguous, ask the user once and record the answer.

Look for an existing in-progress review for this branch: any `.gh-workflows/codereview/*-{branch-slug}/STATE.md` whose `Current phase` is not `done`, `handed-off`. If one exists, resume it (see Resuming). Otherwise start a new one.

Delegate creating the folder: spawn a fresh `general-purpose` sub-agent (via the `Agent` tool, not `fork`) telling it to create `.gh-workflows/codereview/{timestamp}-{branch-slug}/STATE.md` (timestamp from `date +%Y%m%d_%H%M%S`, run at creation time):

```markdown
# Code Review State: {branch name}

## Base branch
{base branch}

## Current phase
collect

## Files reviewed
(none yet)

## Last session end-state
Starting collect.
```

Have it report back the exact folder path it created. Then begin: read `phases/collect.md` and follow it.

## Resuming

Read `.gh-workflows/codereview/{folder}/STATE.md`, determine the current phase, read the matching phase file from `phases/`, and execute it.

If no branch is given as an argument, use the current branch. If you want to review a different branch, `git checkout` it first — this skill always reviews whatever branch is currently checked out.

If the most recent folder for this branch is already `done` or `handed-off`, that review is closed — starting `/gh-codereview-workflow-test` again creates a **new** timestamped folder for a fresh pass (e.g. after `gh-dev-workflow` has fixed the prior round's findings). It never reopens a closed folder.

## Phase sequence

```
collect    → phases/collect.md     (pin diff, list changed files, scaffold the folder)
review     → phases/review.md      (one read-only sub-agent per batch of changed files; writes a report only if it found something)
synthesize → phases/synthesize.md  (merges reports into summary.md; logs DEBT straight to .gh-workflows/plans/tech-debt/)
decide     → phases/decide.md      (live checkpoint: fix → seed & hand off a gh-dev-workflow plan / accept / stop)
```

There are no rounds. This skill runs the pipeline once per invocation; if you want another pass after `gh-dev-workflow` finishes fixing, just run `/gh-codereview-workflow-test` again — it starts a fresh folder against the current diff.

## User checkpoints

Exactly one — `decide`: see the summary and choose fix (hand off to `gh-dev-workflow`) / accept (log as debt, close out) / stop (pause, resumable later). Everything else — collecting the diff, reviewing each file, synthesizing the report — runs autonomously.

## Source of truth

`STATE.md` is always the source of truth for phase state, the same role `PROGRESS/INDEX.md` plays for a `gh-dev-workflow` plan.

## Coding rules

Before reviewing: read `../gh-dev-workflow/coding-rules/INDEX.md` (shipped defaults, shared with gh-dev-workflow so standards don't drift between the two skills) and also `.gh-workflows/plans/coding-rules/INDEX.md` if it exists in the current project (project-specific overrides). From both, load only the rule files relevant to what changed in this diff — a `file` row is read directly, a `skill` row is invoked with the `Skill` tool. Do not load rules that don't apply.

## Relationship to gh-dev-workflow and gh-debt-workflow

- `gh-dev-workflow`'s `review` phase is a pass/fail gate: does the diff match `spec.md`, does it build and test clean. It has no severity tags and no tech-debt log.
- `gh-codereview-workflow-test` (this skill) is the standards/smell pass, and never edits code itself. BLOCK findings, if the user chooses `fix` at the `decide` checkpoint, get written into a **new gh-dev-workflow plan** — seeded directly at the `implement` phase (grill/spec/tickets are skipped since the review already produced the concrete work list; one ticket per BLOCK finding). `gh-dev-workflow` then does the actual fixing, and its own `review` phase re-checks the result against a `spec.md` this skill wrote (framed as "these findings are the requirements") plus the normal lint/build/test/e2e gate — a real safety net against a fix accidentally changing behavior.
- DEBT findings never go through `gh-dev-workflow` — they're logged straight to `.gh-workflows/plans/tech-debt/` at `synthesize` time, same as before.
- `gh-debt-workflow` reads `.gh-workflows/plans/tech-debt/` and decides what's still worth fixing. It doesn't care which skill wrote a given entry.

Beyond the `.gh-workflows/plans/tech-debt/` folder both always share, and the plan folder this skill seeds when the user picks `fix`, none of these three skills calls another directly.
