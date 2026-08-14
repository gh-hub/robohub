# Control Flow

## Prefer guard clauses

Use early returns to remove unnecessary nesting.

Preferred:

```ts
if (!transaction) {
  return;
}

if (!transaction.isApproved) {
  return;
}

await this.processTransaction(transaction);
```

Avoid:

```ts
if (transaction) {
  if (transaction.isApproved) {
    await this.processTransaction(transaction);
  }
}
```

## Nested `if` decision process

When an `if` appears inside another `if`:

1. Check whether the outer condition can become a guard clause or separate condition.
2. Check whether the conditions can be combined without harming readability.
3. If the nested branch represents a separate business decision, extract it into a clearly named function.
4. Keep the nesting only when extraction or flattening would make the flow harder to understand.

Preferred combined condition:

```ts
if (transaction && transaction.isApproved) {
  await this.processTransaction(transaction);
}
```

Preferred extraction for meaningful business logic:

```ts
if (!transaction) {
  return;
}

await this.processApprovedTransaction(transaction);
```

```ts
private async processApprovedTransaction(
  transaction: Transaction,
): Promise<void> {
  if (!transaction.isApproved) {
    return;
  }

  await this.transactionProcessor.process(transaction);
}
```

## Avoid mechanical extraction

Do not create a new function only to hide a simple condition such as:

```ts
private isDefined(value: unknown): boolean {
  return value !== undefined;
}
```

Extract when the function provides a meaningful name, isolates a business rule, or simplifies the main flow.

## Keep the main path visible

Structure functions so the successful or primary path is easy to scan. Handle invalid, missing, disabled, and already-processed cases first.
