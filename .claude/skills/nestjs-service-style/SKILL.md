---
name: nestjs-service-style
description: enforce an opinionated nestjs and typescript service style when generating, reviewing, or refactoring controllers, services, utilities, configuration, and environment validation. use for nestjs implementation work, pull request reviews, architecture cleanup, controller decomposition, utility placement, control-flow simplification, and configservice usage.
---

# NestJS Service Style

Apply these rules when generating, reviewing, or refactoring NestJS code.

## Core workflow

1. Inspect the existing module, folder structure, naming conventions, and configuration approach before changing code.
2. Preserve established project conventions unless they conflict with a rule in this skill.
3. Prefer focused changes. Do not refactor unrelated code without a clear maintainability benefit.
4. Improve readability rather than applying rules mechanically.
5. After making changes, run the checklist in [references/review-checklist.md](references/review-checklist.md).

## Non-negotiable rules

- Prefer guard clauses and early returns over nested `if` statements.
- Extract standalone class functions into appropriately scoped `{base}.util.ts` files.
- Place utilities at the narrowest directory level shared by all consumers.
- Keep controllers thin. Split complex endpoint behavior into focused services.
- Validate every environment variable during application startup with Joi or Zod.
- Prevent server startup when a mandatory environment variable is missing or invalid.
- Do not access `process.env` directly outside the configuration layer.

## Detailed guidance

- For nested conditions, guard clauses, and extraction decisions, read [references/control-flow.md](references/control-flow.md).
- For standalone functions, utility naming, and directory placement, read [references/utilities.md](references/utilities.md).
- For controller size, orchestration, and service splitting, read [references/controllers-and-services.md](references/controllers-and-services.md).
- For environment validation and NestJS `ConfigService` conventions, read [references/configuration.md](references/configuration.md).

## Review behavior

When reviewing existing code:

1. Identify concrete violations with file and function names.
2. Explain why each change improves readability, testability, or ownership.
3. Propose the smallest clear refactor.
4. Do not extract trivial code merely to reduce line count.
5. State explicitly when the current implementation is clearer and should remain unchanged.

## Generation behavior

When generating new code:

1. Follow the current feature/module structure.
2. Create only the files needed for the requested behavior.
3. Use explicit, responsibility-based names.
4. Keep domain orchestration in services and pure transformations in utilities.
5. Include or update startup environment validation whenever configuration is introduced.
