# Notes: implement/review-round-1-fix-03-spec-remove-unrequested-dev-script

## What was built
Removed the unrequested `"dev": "npm run start"` entry from `app/package.json`'s `scripts` object. It was flagged in review round 1 as scope creep — spec.md's Implementation Decisions only called for a `rebuild-native` step wired into the existing build/start scripts, not a new `dev` alias, and `"start"` already performs the full build+launch.

Before removing, grepped the whole repo for `npm run dev` / `"dev"` / `run dev` references. The only hits were: the `package.json` entry itself, an unrelated `"dev": true`-shaped key in `app/package-lock.json` (standard npm lockfile metadata, not a script reference), and this plan's own planning/notes/ticket files (historical record, left as-is). No README, CI config, or other script referenced `npm run dev`, so the removal was a clean no-op elsewhere.

Ran `npm run typecheck` (clean) and `npm test` (218/218 passing) in `app/` after the change — nothing broke.

## Summary
All three round-1 fix tickets are now complete (security: log-buffer cap, spec: USB connect contract + error surfacing, spec: remove unrequested dev script) — review round 2 is next.
