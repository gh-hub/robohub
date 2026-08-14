---
name: gh-dev-workflow/review
description: Phase 5 of gh-dev-workflow. Pass/fail gate — checks the implemented diff against spec.md, checks it for concrete security vulnerabilities, and confirms lint, build, unit/integration tests, and e2e tests all pass. No severity tags, no tech-debt log, no standards/smell pass (that's the separate gh-codereview-workflow-test skill). On failure, writes fix tickets and loops back to implement automatically for up to 2 rounds; round 3+ needs a live user decision. On pass, one live checkpoint to archive. Always runs live — never delegated whole, since it may need to check in with the user partway through.
---

# Review Phase

## Purpose

Confirm three things about everything implemented so far: it does what `spec.md` says (no missing or wrong requirements, no unrequested scope), it introduces no concrete security vulnerability, and it actually works — lint, build, unit/integration tests, and e2e tests all pass. This is a pass/fail gate, not a full code-quality review — no severity tags, no tech-debt log, no standards or smell pass. For that, run the standalone `/gh-codereview-workflow-test` skill against this branch, any time, independent of this phase.

## Process

### 1. Load context

Read `.gh-workflows/plans/{folder}/PROGRESS/INDEX.md` first — source of truth. Confirm the current phase is `review/round-{N}` (N=1 the first time a plan enters review). If it is not, stop and tell the user — do not proceed.

If the Phases table has no `review/round-{N}` row yet (rounds 2+ only get their row added lazily, on first entry), add it now with status `in-progress` and `Started` stamped to the current timestamp (`date +"%Y-%m-%d %H:%M:%S"`). If the row already exists but `Started` is still empty, stamp it the same way and set status to `in-progress`. Either way, a direct quick edit, not delegated. Leave it untouched if `Started` is already set (a resumed session).

Read `.gh-workflows/plans/{folder}/CONTEXT.md` and `.gh-workflows/plans/{folder}/spec.md`.

### 2. Pin the diff

The diff is everything implemented since the tickets were started:
```
git diff {base-branch}...HEAD
```
If the base branch is unclear, read `PROGRESS/INDEX.md` — it should record the branch state at ticket start. If still unclear, ask the user once and record the answer.

Confirm the diff is non-empty before spawning the sub-agent.

### 3. Check spec match and security

Spawn two sub-agents in parallel (`Agent` tool, `general-purpose` type, Bash access, one message with both calls — they're independent). Each must run the diff command itself — do not paste the diff into either prompt.

**Spec-match sub-agent** — give it the full contents of `spec.md` and this brief: "Run `git diff {base-branch}...HEAD`, then report: (a) requirements missing or partial; (b) behavior in the diff not asked for (scope creep); (c) requirements that look implemented but are wrong. Quote the spec line for each finding. No severity tags needed — every finding here is a gap that must close. Under 300 words."

**Security sub-agent** — give it this brief: "Run `git diff {base-branch}...HEAD`, then check the changed lines against this baseline:
  - **Injection** — unsanitized input reaching a SQL/NoSQL/command/LDAP/template sink
  - **Broken authentication/session handling** — missing auth checks, weak/predictable session tokens, session fixation
  - **Broken access control** — missing authorization checks, IDOR, privilege escalation paths
  - **Sensitive data exposure** — hardcoded secrets/credentials/PII, secrets logged or returned in responses, missing encryption for sensitive data in transit/at rest
  - **Security misconfiguration** — permissive CORS, disabled TLS/cert verification, stack traces or internal errors exposed to callers, insecure defaults
  - **Cross-site scripting (XSS)** — unescaped user input rendered into HTML/JS
  - **Insecure deserialization** — deserializing untrusted data without validation
  - **Vulnerable dependencies** — a newly added/bumped dependency with a known CVE, if evident from the diff
  - **Insufficient input validation** — missing bounds/type/format checks on user-controlled input before use
  - **SSRF** — server-side requests built from user-controlled URLs/hosts without allowlisting
  - **Path traversal** — user input used to build file paths without sanitization
  - **Cryptographic issues** — weak/broken algorithms (e.g. MD5/SHA1 for passwords, ECB mode), hardcoded keys/IVs, insufficient randomness for tokens/nonces
  - **CSRF** — state-changing endpoints missing CSRF protection where the framework requires it

  Report only concrete, exploitable issues introduced by this diff — not general hardening advice or anything outside the changed lines. For each finding: name the vulnerability class, quote the vulnerable hunk, and state the concrete exploit scenario (what input or actor triggers it, what breaks). No severity tags needed — every finding here is a vulnerability that must close before merge, same as a spec gap. Under 300 words."

### 4. Check it works

Run each of the following via Bash, in this order, stopping to record a failure but still running the rest (don't bail on the first red check — the report should show everything that's wrong at once):

1. **Lint** — the project's lint command
2. **Build** — the project's build/typecheck command
3. **Unit/integration tests** — the project's regular test suite
4. **E2E tests** — the project's end-to-end suite, if one exists

Discover each command from `package.json` scripts (e.g. `lint`, `build`, `test`, `test:e2e`/`e2e`/`cypress`/`playwright test`), a `Makefile`, or the README. If a project genuinely has no e2e suite, note that and skip it — that's not a failure. If any command is genuinely ambiguous, ask the user once and record the answer in `CONTEXT.md` so later rounds don't ask again. Record pass/fail and the failure output for each check that ran.

If the unit/integration suite or the e2e suite fails, rerun that same command once in full before recording anything. If the rerun is green, record that check as **flaky** (not a failure) — it does not fail the round on its own, but carry the note ("{check} failed once, passed on rerun") through to whichever write-up step actually runs (6a's findings.md if the round fails for some other reason, 6b's notes/review-round-{N}.md if the round otherwise passes). If the rerun fails too, record it as a genuine failure using the rerun's output. Lint and build failures are deterministic — record them as failures immediately, no rerun.

### 5. Decide pass/fail

**PASS** = the spec-match sub-agent found no findings AND the security sub-agent found no findings AND every check in step 4 that applies to this project (lint, build, unit/integration tests, e2e tests) passes.
**FAIL** = otherwise — record which specific check(s) failed, including which sub-agent(s) reported findings.

### 6a. On FAIL

Delegate the write-up (per the Delegation discipline in `SKILL.md`, this phase always runs live, but the mechanical tail below can go to a fresh `general-purpose` sub-agent, `model: haiku` — the findings below were already generated by the step-3 sub-agents, this step only reformats them into files and tickets):

1. Write `.gh-workflows/plans/{folder}/review/round-{N}/findings.md` — the spec sub-agent's findings verbatim under a "Spec match" heading, the security sub-agent's findings verbatim under a "Security" heading, plus a checklist of every step-4 check that ran (lint / build / unit-integration / e2e) with pass/fail and the failure output for any that failed. Mark any check that failed once but passed on rerun as `flaky` in this checklist, not `fail`.
2. Write one fix ticket per finding (spec and security alike) to `.gh-workflows/plans/{folder}/review/round-{N}/tickets/`, numbered from `01`, same format as `phases/tickets.md`. Tag each ticket's title with its source (`[spec]` / `[security]`) so a security fix isn't mistaken for a feature gap.
3. Update `PROGRESS/INDEX.md` first, then `CONTEXT.md` to match:
   - `PROGRESS/INDEX.md`: mark `review/round-{N}`'s row `FAIL` in the Phases table, stamping `Finished` with the current timestamp (`date +"%Y-%m-%d %H:%M:%S"`), set current phase to `implement`, set `Current ticket path` to `.gh-workflows/plans/{folder}/review/round-{N}/tickets/01-{slug}.md`, point "Last session end-state" at `notes/review-round-{N}.md`.
   - `PROGRESS/notes/review-round-{N}.md`: the findings summary (one-line-per-check gate result plus the spec-match gaps and the security findings), linking to `review/round-{N}/findings.md` for full detail.
   - `CONTEXT.md`: note round `{N}` failed (one line, link to `findings.md`), set current phase to `implement`, set current ticket to the same path.
   - `INDEX.md`: add link to `review/round-{N}/findings.md`, update status to `fixing`.

**If N ≤ 2**: no user input is needed — this is an objective gate, not a judgment call. Hand off exactly like `implement.md` does: "Review round {N}: {one-line summary of what's missing/broken}. Start a new session and run `/gh-dev-workflow` to fix it." Under auto mode, the conductor loops straight back into `implement` without stopping.

**If N ≥ 3**: stop and ask the user live — this exceeds the standard 2-round auto-fix limit, regardless of auto mode:
```
Review round {N} still failing after {N} rounds: {one-line summary of what's wrong}.

  "continue" — keep fixing (round {N+1})
  "stop"     — leave the plan in-progress, no further auto-fixing

Reply with one of those two words.
```
Record the decision in `PROGRESS/INDEX.md`/`CONTEXT.md`. On "continue", proceed exactly as the N≤2 case above. On "stop", record `review paused at round {N} — left in-progress by user` in `PROGRESS/INDEX.md`'s "Last session end-state" (and in `notes/review-round-{N}.md`) and stop; tell the user: "Review paused at round {N}. Plan remains at `.gh-workflows/plans/{folder}`. Run `/gh-dev-workflow` to resume when ready."

### 6b. On PASS

This is a live checkpoint — never delegate it:
```
Review round {N}: implementation matches spec.md, no security findings. Lint, build, tests, and e2e all pass.

Reply "done" to archive this plan.
```

Once the user replies "done", delegate the write-up to a fresh `general-purpose` sub-agent (`model: haiku` — purely mechanical bookkeeping and a folder move, no decisions):
1. `PROGRESS/INDEX.md`: mark `review/round-{N}`'s row `PASS`, stamping `Finished` with the current timestamp (`date +"%Y-%m-%d %H:%M:%S"`), set current phase to `(complete)`, point "Last session end-state" at `notes/review-round-{N}.md`.
2. `PROGRESS/notes/review-round-{N}.md`: confirm spec-match clean, no security findings, and the full gate green, with a one-line summary of what passed. If any check in step 4 was flaky (failed once, passed on rerun), note that here too.
3. `CONTEXT.md`: add "Plan complete".
4. `INDEX.md`: update status to `complete`.
5. Create `.gh-workflows/plans/done/` if it doesn't exist, then move the plan folder to `.gh-workflows/plans/done/YYYYMMDD_HHMMSS-{name}/` (reuse the plan's original timestamp/name, not a new one).

Tell it never to run `git commit`/`git push`, never to talk to the user, and to report back one line confirming what was written and moved. Wait for it to finish before proceeding.

Tell the user: "Plan complete. Moved to `.gh-workflows/plans/done/{folder}`."
