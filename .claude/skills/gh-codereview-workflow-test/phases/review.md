---
name: gh-codereview-workflow-test/review
description: Second phase of gh-codereview-workflow-test. Spawns one read-only sub-agent per batch of changed files to check them against coding standards and the smell baseline. A file gets a report only if the sub-agent found something. No user input needed.
---

# Review Phase

## Purpose

Check every changed file against the coding standards and the smell baseline — nothing else, and no edits. Files are grouped into batches and each batch is reviewed by its own sub-agent, so the number of sub-agents scales with the size of the change, not the file count. A clean file produces no report — only files with something to say get a doc.

## Process

### 1. Load context

Read `.gh-workflows/codereview/{folder}/STATE.md` first — source of truth. Confirm the current phase is `review`. If it is not, stop and tell the user — do not proceed.

Read `.gh-workflows/codereview/{folder}/files.md` for the numbered file list.

Then read just the index files — not the full rule content:
- `../gh-dev-workflow/coding-rules/INDEX.md` (shipped defaults, shared with gh-dev-workflow) and `.gh-workflows/plans/coding-rules/INDEX.md` if it exists in this project (project-specific overrides).
- Note any `CODING_STANDARDS.md` or `CONTRIBUTING.md` in the repo root, by path.

From the indexes, determine which specific rule files are actually relevant to what changed in this diff (by language/framework/area) — a `file` row's path is used directly, a `skill` row (e.g. `nestjs-service-style`) resolves to its relevant reference file path(s). You only need the paths here; each batch's sub-agent will `Read` the actual content itself in step 3, so don't paste rule-file contents into your own context.

### 2. Determine remaining work and batch the files

Check `STATE.md`'s "Files reviewed" section against the numbered list in `files.md`. Skip any file already listed there — this makes the phase resumable after an interruption without re-reviewing files that already finished.

Group the remaining files into batches: aim for roughly 6-8 files or ~400 diff lines per batch, whichever limit is hit first. Keep files from the same directory/module together where that falls out naturally, but don't force it. A single very large file can be its own batch.

### 3. Spawn one read-only sub-agent per batch

Use `subagent_type: general-purpose`. Spawn up to 8 concurrent sub-agents at a time (all in one message per round — independent calls run in parallel — then wait for that round before starting the next round), rather than all at once, to keep concurrency reasonable on large diffs.

Give each sub-agent:
- The list of files in its batch, each with its number from `files.md`
- The diff command scoped to its batch: `git diff {base-branch}...HEAD -- {file1} {file2} ...`
- The exact paths to the relevant rule files identified in step 1, plus any `CODING_STANDARDS.md`/`CONTRIBUTING.md` path — tell it to `Read` each one itself. Don't mention irrelevant rule files.
- The smell baseline pasted in full (small and fixed-size regardless of batch size, so inlining it costs nothing extra):
  - **Mysterious Name** — rename it; if no honest name comes, the design is murky
  - **Duplicated Code** — extract the shared shape
  - **Feature Envy** — move the method onto the data it envies
  - **Data Clumps** — bundle repeated field groups into one type
  - **Primitive Obsession** — give the concept its own small type
  - **Repeated Switches** — replace with polymorphism or a shared map
  - **Shotgun Surgery** — gather what changes together into one module
  - **Divergent Change** — split so each module changes for one reason
  - **Speculative Generality** — delete abstraction nothing needs
  - **Message Chains** — hide the walk behind one method
  - **Middle Man** — cut it, call the real target direct
  - **Refused Bequest** — drop the inheritance, use composition
- Brief: "Run the diff command with Bash. Read the rule-file paths given above. This is a **read-only** review — you may use `Write` only to create report files at the exact paths given below; never `Edit` or `Write` any file under review. For each file in your batch, check its diff for: (a) every place it violates one of the rule files you read — cite the standard; (b) any smell from the baseline above — name it and quote the hunk. Tag each finding BLOCK (must fix before ship) or DEBT (real problem, not a blocker). Distinguish hard violations from judgement calls. Skip anything tooling enforces. For any file with no findings, write no file for it at all. For a file with findings, write `.gh-workflows/codereview/{folder}/reports/{NN}-{file-slug}.md`:
  ```markdown
  # Review: {file path}

  ## Findings
  {findings, each tagged BLOCK or DEBT, with rule/smell citation and the quoted hunk}
  ```
  Report back one line per file: `{NN} {file path} — BLOCK: {count}, DEBT: {count}` or `{NN} {file path} — clean`."

`{NN}` is that file's number from `files.md`, `{file-slug}` is the path with `/` replaced by `-`.

### 4. Record progress

Once all batches across all rounds have returned, update `STATE.md` yourself, directly — no sub-agent needed:
- Append every file just processed to "Files reviewed" (one line each: `{NN} {file path} — BLOCK: {count}, DEBT: {count}` or `— clean`)
- Set current phase to `synthesize`
- Update "Last session end-state"

Never run `git commit`/`git push`.

### 5. Hand off

This phase never talks to the user directly. Continue immediately to `phases/synthesize.md`.
