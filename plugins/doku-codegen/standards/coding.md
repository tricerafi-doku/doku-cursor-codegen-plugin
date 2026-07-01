# Coding Standards (Language-Agnostic)

Applied to all generated SDK code regardless of language. Language-specific standards extend these.

## Architecture
- Shared components (signature, token manager, HTTP client, config) are standalone modules — never inlined
- Each payment method gets its own API class/module — not a monolithic client
- DTOs/models are separate from business logic
- Configuration is externalized (env vars or config file), not embedded

## Naming
- Follow the target language's standard conventions (camelCase, snake_case, PascalCase)
- Use DOKU domain terms consistently: `virtualAccount`, `createVa`, `checkStatus`, `doPayment`
- Boolean methods/fields: prefix with `is`, `has`, `should` (e.g., `isProduction`, `hasExpired`)
- Constants: UPPER_SNAKE_CASE (e.g., `SNAP_BASE_URL`, `SIGNATURE_ALGORITHM`)

## Error Handling
- Use typed errors/exceptions per error category — never generic catch-all
- Categories: `DokuAuthError`, `DokuValidationError`, `DokuApiError`, `DokuNetworkError`, `DokuSignatureError`
- Include `request_id`, `response_code`, and `message` in error objects
- Propagate errors to caller — don't silently swallow

## Logging
- Use structured logging (key-value pairs), not string interpolation
- Required fields on every log: `request_id`, `timestamp`, `endpoint`, `http_method`
- Log at appropriate levels:
  - ERROR: Failed API calls, signature mismatches, unhandled exceptions
  - WARN: Retries, approaching token expiry, deprecated API usage
  - INFO: Successful transactions, token refresh
  - DEBUG: Request/response bodies (with secrets redacted)
- **NEVER** log: Secret Key, Private Key, full card numbers, CVV, raw passwords

## Documentation
- Public methods: doc comment with description, parameters, return value, exceptions/errors
- Shared components: module-level doc explaining purpose and usage
- No inline comments for obvious code — only for non-obvious business logic (e.g., why DOKU requires minified JSON)

## Null Safety
- Use the language's null safety features (Optional in Java, Optional/None in Python, ?. in TypeScript, etc.)
- Never return null from public methods — return empty collections, Optional, or error types
- Validate nullable API response fields before accessing

## Immutability
- DTOs/request objects should be immutable once constructed (builder pattern or frozen dataclass)
- Configuration is read-once at initialization
- Token cache is the only mutable shared state — must be thread-safe

## Testability
- All shared components accept dependencies via constructor (no global singletons)
- HTTP client is injectable/mockable for testing
- Config provider is injectable for test overrides
- Clock/timestamp generation is injectable for deterministic tests

## Testing Requirements

Minimum coverage: **80%** across all generated code. Required test types:

1. **Unit tests** — signature computation, request building, error mapping
2. **Integration tests** — full request/response cycle against a mock HTTP server
3. **Sandbox tests** — optional real calls against DOKU sandbox; tag separately so CI can skip them

Test-driven approach for new payment methods:
1. Write failing test for signature computation (RED)
2. Implement interceptor/middleware to pass (GREEN)
3. Verify coverage before marking complete

**DOKU-specific test fixtures:**
- Mock HTTP server returns canned DOKU responses — never hit real sandbox in unit/integration tests
- Test at least one 200 success, one 401 signature error, one 400 validation error per endpoint
- Verify `Request-Id` is unique across multiple calls
- Verify timestamp format is `yyyy-MM-dd'T'HH:mm:ss'Z'` (UTC, no millis)
- For SNAP: mock token endpoint separately; test token expiry + refresh path

## File Size
- Functions: max 50 lines
- Files: max 800 lines — extract to submodules when approaching limit
- No deep nesting: max 4 levels of indentation
