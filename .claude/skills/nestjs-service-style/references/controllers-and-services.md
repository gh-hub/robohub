# Controllers and Services

## Controller responsibilities

Keep controllers focused on transport-layer concerns:

- Route definitions.
- Authentication and authorization metadata.
- Request DTOs and parameter extraction.
- Calling application services.
- Mapping or returning the response.

Do not place complex business rules, persistence logic, external API orchestration, or large condition trees in controllers.

## Split complex controllers by responsibility

Do not split based only on line count. Split when the controller or its endpoint handlers contain multiple responsibilities or complex flows.

When a controller becomes too complex:

1. Create a `services/` folder inside the feature directory when it improves organization.
2. Extract each meaningful workflow into a focused service.
3. Allow the controller to inject and use multiple services when endpoints represent different responsibilities.
4. Prefer one clear orchestration service per endpoint.

Example:

```text
transactions/
  transactions.controller.ts
  services/
    create-transaction.service.ts
    approve-transaction.service.ts
    cancel-transaction.service.ts
```

```ts
@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly createTransactionService: CreateTransactionService,
    private readonly approveTransactionService: ApproveTransactionService,
  ) {}

  @Post()
  create(@Body() dto: CreateTransactionDto): Promise<TransactionDto> {
    return this.createTransactionService.execute(dto);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string): Promise<void> {
    return this.approveTransactionService.execute(id);
  }
}
```

## Service boundaries

Create a separate service when the extracted code has a clear responsibility and meaningful name.

Avoid creating services that only wrap one trivial repository call without adding ownership, policy, or orchestration.

## Dependency direction

Controllers may depend on application services. Application services may depend on repositories, gateways, clients, and focused domain services. Utilities must not depend on NestJS dependency injection.
