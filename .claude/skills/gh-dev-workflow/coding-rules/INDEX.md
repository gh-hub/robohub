# Coding Rules Index (skill defaults)

Ships with the gh-dev-workflow skill — same across every project it's installed in. Load this file at the start of every implement and review session, then load only the rule files that apply to the current ticket's tech stack. Do not load rules that don't apply.

## Rule files

| File | Type | Load when |
|---|---|---|
| [general.md](general.md) | file | Always |
| [node-typescript-docker.md](node-typescript-docker.md) | file | Node/TypeScript apps (NestJS, Next.js) built inside Docker |
| [nestjs-service-style](../../nestjs-service-style/SKILL.md) | skill | Ticket touches NestJS controllers, services, configuration, or utilities |

A `file` row is a plain reference doc — read it. A `skill` row is a real Claude Code skill — invoke it with the `Skill` tool (it loads its own `SKILL.md` and pulls in its own reference files as needed), don't just `Read` it.

## Project overrides

If `.gh-workflows/plans/coding-rules/INDEX.md` exists in this project, read it too — project-specific rules there add to or override the rows above where they conflict. Most projects won't have one; that's expected, not an error. See `.gh-workflows/plans/coding-rules/` in `plan-structure.md` for when to create it.

## Adding rules

Only add a row here after you have created the file (or confirmed the skill exists). A missing file is worse than a missing row. Add rules as you discover them during implementation or review — general, stack-wide rules go here; anything true of one project only belongs in that project's `.gh-workflows/plans/coding-rules/`, not here.
