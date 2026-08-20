# 03 — [spec] Remove unrequested "dev" npm script (scope creep)

**What to build:** `app/package.json` added a new `"dev": "npm run start"` script during implementation. spec.md's Implementation Decisions only call for a `rebuild-native` step to be wired into "the existing build/start scripts" — it does not ask for a new `dev` alias, and `"start"` already does the full build+launch. Remove the `"dev"` script entry from `app/package.json` since it is redundant with the existing `"start"` script and was not part of the spec.

**Blocked by:** None — can start immediately.

- [x] The `"dev"` entry is removed from `app/package.json`'s `scripts`
- [x] Nothing else in the app references or depends on the `"dev"` script (check for any references before removing)
- [x] `npm run typecheck` and `npm test` in `app/` still pass
