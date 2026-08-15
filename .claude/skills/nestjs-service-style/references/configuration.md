# Environment Configuration

## Validate all environment variables at startup

Define every environment variable in a Joi or Zod validation schema. Run this validation before the NestJS application starts accepting requests.

Required behavior:

- Fail startup when a mandatory variable is missing or invalid.
- Give optional variables an explicit default when a safe and meaningful default exists.
- Treat empty strings as missing unless an empty string is intentionally valid.
- Parse numbers and booleans into their real runtime types.
- Validate URLs, enums, ports, durations, and structured values with appropriate schemas.
- Never give secrets unsafe placeholder defaults.
- Do not access `process.env` directly outside the configuration/bootstrap layer.

Example with Joi:

```ts
export const environmentValidationSchema = Joi.object({
  PORT: Joi.number().port().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .required(),
  RETRY_COUNT: Joi.number().integer().min(0).default(3),
  OPTIONAL_WEBHOOK_URL: Joi.string().uri().optional(),
  INTERNAL_API_SECRET: Joi.string().min(32).required(),
});
```

Example bootstrap:

```ts
ConfigModule.forRoot({
  isGlobal: true,
  validationSchema: environmentValidationSchema,
  validationOptions: {
    abortEarly: false,
    allowUnknown: true,
  },
});
```

## `ConfigService` access convention

Follow this project-specific convention exactly:

- When the validated environment variable has a default value, read it with `configService.getOrThrow()`.
- When the environment variable has no default value, read it with `configService.get()`.

Example:

```ts
const retryCount = this.configService.getOrThrow<number>('RETRY_COUNT');

const optionalWebhookUrl =
  this.configService.get<string>('OPTIONAL_WEBHOOK_URL');

const internalApiSecret =
  this.configService.get<string>('INTERNAL_API_SECRET');
```

A mandatory variable without a default must still fail during startup validation. Do not use `getOrThrow()` as a replacement for startup validation.

## Typed configuration

Prefer centralized typed configuration objects or registered configuration namespaces when the project already uses them. Application code should consume validated values rather than raw strings.

## Feature-specific optional configuration

When credentials are optional because an integration can be disabled:

- Use an explicit enable/disable configuration value when appropriate.
- Validate required credentials conditionally when the feature is enabled.
- Do not provide fake secret defaults merely to satisfy validation.
