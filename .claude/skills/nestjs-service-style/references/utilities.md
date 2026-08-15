# Utilities

## Extract standalone logic from classes

Move a class function to a `{base}.util.ts` file when all of the following are true:

- It does not use `this`.
- It does not require injected dependencies.
- Its result depends only on its arguments.
- It performs transformation, mapping, formatting, parsing, calculation, or reusable validation.

Example:

```ts
// transaction.util.ts
export function buildTransactionKey(
  assetId: string,
  transactionId: string,
): string {
  return `${assetId}:${transactionId}`;
}
```

Do not keep this as a private class method merely because it is currently called from one service.

## Keep orchestration in services

Do not move logic to a utility when it represents application orchestration or depends on repositories, clients, configuration, logging, or other injected collaborators.

Keep behavior in a service when it:

- Coordinates multiple dependencies.
- Performs database or network calls.
- Owns a domain workflow.
- Controls retries, transactions, locks, or side effects.

## Utility placement

Place a utility at the narrowest directory level shared by all of its consumers.

Rules:

1. Used by one file only: keep it beside that file unless extraction improves testing or readability.
2. Used by files in one feature folder: place it in that feature folder.
3. Used by multiple sibling folders: move it to their nearest common parent.
4. Used across unrelated modules: move it to an application-level shared or common utilities directory.

Example:

```text
fireblocks/
  callbacks/
    callback.controller.ts
    callback.service.ts
  signing/
    signing.service.ts
  fireblocks.util.ts
```

Use `fireblocks.util.ts` when both `callbacks` and `signing` need the same Fireblocks-specific utility.

## Naming

Use responsibility-based filenames:

- `transaction.util.ts`
- `fireblocks-signature.util.ts`
- `market-stop-message.util.ts`

Avoid vague names:

- `utils.ts`
- `helpers.ts`
- `common.util.ts`

Use named exports. Avoid default exports for utilities.

## Prevent utility dumping grounds

If a utility file grows to contain unrelated concerns, split it by responsibility rather than adding more functions to a generic file.
