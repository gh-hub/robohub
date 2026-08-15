---
name: gh-codereview-workflow-test/collect
description: First phase of gh-codereview-workflow-test. Pins the branch diff, lists every changed file, and scaffolds the review folder. No user input needed.
---

# Collect Phase

## Purpose

Pin down exactly what this review covers before any file gets checked: the diff against the base branch, and the list of files it touches.

## Process

### 1. Load context

Read `.gh-workflows/codereview/{folder}/STATE.md` first — source of truth. Confirm the current phase is `collect`. If it is not, stop and tell the user — do not proceed.

### 2. Pin the diff

The diff is everything on this branch not yet on the base branch recorded in `STATE.md`:
```
git diff {base-branch}...HEAD --stat
```

Confirm the diff is non-empty before continuing.

### 3. List changed files

From the diff, get the file list and per-file change size (`git diff {base-branch}...HEAD --stat` gives both). This skill reviews code only — exclude:
- Documentation/prose: `*.md`, `*.mdx`, `*.txt`, `*.rst` (this skill checks coding standards and smells, never doc content — see `gh-dev-workflow`'s `review` phase for anything spec/business related)
- Generated/vendored noise no coding-standard review can meaningfully apply to: lockfiles (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `Gemfile.lock`, ...), snapshot files (`*.snap`), and anything under a `dist/`, `build/`, `node_modules/`, or `.next/` path

Keep everything else, including small files. Files are reviewed in batches, not one at a time (see `phases/review.md`).

### 4. Scaffold the folder

Do this yourself, directly — it's mechanical file-writing, no sub-agent needed:

1. Create `.gh-workflows/codereview/{folder}/reports/` (empty — populated by the review phase).
2. Write `.gh-workflows/codereview/{folder}/files.md`:
   ```markdown
   # Changed files — {branch name}

   ## Reviewed
   01. {path} ({+N -M})
   02. {path} ({+N -M})
   ...

   ## Skipped (docs/generated/vendored)
   - {path}
   - ...
   ```
   Number the "Reviewed" list from `01` — this numbering is what `review.md` uses for report filenames.
3. Update `STATE.md`:
   - Set current phase to `review`
   - Update "Last session end-state": `{N} files to review, {M} skipped as docs/generated. Starting review.`

Never run `git commit`/`git push`.

### 5. Hand off

This phase never talks to the user directly. Continue immediately to `phases/review.md`.
