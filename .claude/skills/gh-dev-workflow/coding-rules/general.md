# General Coding Rules

Applies to all projects and tech stacks. Loaded in every implement and review session.

## Naming

- Names must say what the thing IS or DOES, not how it's implemented.
- Avoid generic names: `handler`, `manager`, `utils`, `helpers`, `data`, `info`.
- Boolean names start with `is`, `has`, or `can`.

## Functions

- A function does one thing. If you need "and" to describe it, split it.
- No side effects that callers can't see from the signature.
- Max 3 parameters. Beyond that, group into a typed object.

## Comments

- No comments that describe WHAT the code does — the code does that.
- Comments only for WHY: a non-obvious constraint, a workaround for a specific bug, a hidden invariant.
- No commented-out code. Delete it — git has history.

## Error handling

- Only handle errors at system boundaries (user input, external APIs, filesystem, network).
- Do not add fallbacks for scenarios that cannot happen.
- Do not swallow errors silently.

## Tests

- Test external behavior, not implementation details.
- One assertion per test where possible.
- Test names describe the scenario, not the function name.
- Do not mock internals — mock at system boundaries only.

## UI verification

- Verify UI/frontend changes with Playwright (script or MCP), not the claude-in-chrome browser tool.
- If Playwright isn't set up yet in a web app ticket, set it up as part of that ticket rather than falling back to claude-in-chrome.

## No over-engineering

- Do not add abstractions beyond what the current ticket requires.
- Three similar lines of code is better than a premature abstraction.
- No feature flags, backwards-compat shims, or speculative generality unless the spec explicitly asks for it.
