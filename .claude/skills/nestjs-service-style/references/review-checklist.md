# Review Checklist

Use this checklist after generating or refactoring NestJS code.

## Control flow

- Can nested `if` statements become guard clauses?
- Can independent conditions be separated cleanly?
- Does an extracted function represent a meaningful business decision?
- Is the main successful path easy to scan?

## Utilities

- Does any class method avoid `this` and injected dependencies?
- Should that method move to a `{base}.util.ts` file?
- Is each utility located at the narrowest shared directory level?
- Are utility files named by responsibility rather than `helpers` or `utils`?
- Does any utility file mix unrelated concerns?

## Controllers and services

- Does the controller contain business logic or persistence logic?
- Does a complex controller need a `services/` folder?
- Does each extracted service have one clear responsibility?
- Is each endpoint delegating to a clear application workflow?
- Were trivial wrapper services avoided?

## Configuration

- Is every newly used environment variable included in Joi or Zod validation?
- Does validation run at application startup?
- Do mandatory missing values prevent server startup?
- Do optional values have safe defaults where appropriate?
- Are numbers and booleans transformed to their correct types?
- Is direct `process.env` access avoided outside configuration/bootstrap code?
- Is `getOrThrow()` used for values with defaults?
- Is `get()` used for values without defaults?

## Scope and quality

- Are changes limited to the requested behavior and necessary cleanup?
- Were current project naming and folder conventions preserved?
- Did any mechanical extraction make the code harder to understand?
- Are tests added or updated for changed business behavior?
