# Security Standards

These standards are enforced on all generated SDK code. Removing any standard triggers a warning with specific risk.

## Secrets Management
- **NEVER** hardcode credentials (Client ID, Secret Key, Private Key, Public Key, DOKU Public Key)
- All secrets use named placeholders: `DOKU_CLIENT_ID`, `DOKU_SECRET_KEY`, `DOKU_PRIVATE_KEY`, `DOKU_PUBLIC_KEY`, `DOKU_PUBLIC_KEY_DOKU`
- Ask user for storage method: environment variables, vault, config file outside VCS, framework secret store
- Generate a secrets template appropriate to the target stack:
  - **Non-Java stacks (Python, Node.js, Go, PHP)**: generate `.env.example` with all required secrets and descriptions; add `.env` to `.gitignore`.
  - **Java / Kotlin (Spring Boot)**: **do NOT generate `.env`** — Spring Boot has no native `.env` loader. Instead generate an `application-example.yml` (or `application-<profile>.yml.example`) with the secret placeholders, and rely on Spring's `${DOKU_CLIENT_ID:}` env-var injection at runtime. See `standards/java.md` for details.
- Add secret file patterns to `.gitignore` regardless of stack (`.env`, `*.pem`, `*.key`, `application-local.yml`).

## Transport Security
- Enforce TLS 1.2+ on all outbound HTTP connections
- Never disable SSL certificate verification — not even for testing
- For sandbox testing, DOKU sandbox supports TLS — no need to bypass
- **Downgrade risk**: Disabling TLS exposes payment data (card numbers, bank accounts) to MITM attacks

## Input Validation
- Validate all request parameters before sending to DOKU:
  - `amount`: Positive number, correct decimal places for currency
  - `currency`: Must be valid ISO 4217 code (default IDR)
  - `invoice_number`: Non-empty, max length per DOKU spec
  - `customer.email`: Valid email format
  - `customer.phone`: Valid phone format
  - `expiry_date`: Must be in the future
  - `virtual_account_no`: Correct format per bank requirements
- Reject invalid inputs locally before making API calls

## Output Validation
- Verify DOKU response signatures on ALL inbound data (notifications, API responses)
- Reject unsigned or incorrectly signed responses/notifications — return HTTP 400
- Parse JSON non-strictly (tolerate new fields DOKU may add)
- Never trust response data without signature verification

## Error Handling
- Never expose stack traces, internal file paths, or raw DOKU error responses to end users
- Log errors with structured fields: `request_id`, `error_code`, `endpoint`, `timestamp`
- Map DOKU error codes to merchant-friendly messages
- Distinguish between retryable errors (5xx, timeout) and non-retryable (4xx)

## Cryptographic Standards
- RSA key size: 2048 bits minimum
- Signature algorithms: SHA256withRSA (asymmetric), HMAC-SHA512 (SNAP symmetric), HMAC-SHA256 (Non-SNAP symmetric)
- Never implement custom cryptographic algorithms — use standard library implementations
- Timestamp tolerance: Generated timestamps must be UTC, within acceptable clock skew

## Network Security
- Set connection timeout: 10 seconds (configurable)
- Set read timeout: 30 seconds (configurable)
- Implement idempotency-safe retries only (same Request-Id for retries)
- Maximum retry attempts: 3 with exponential backoff
- Never retry non-idempotent mutations without same Request-Id

## Dependency Security
- Use only well-maintained HTTP client libraries with active security patches
- Pin dependency versions (exact, not ranges)
- Prefer standard library crypto over third-party (e.g., Java's javax.crypto, Python's hashlib/hmac, Node's crypto)

## Notification Security
- Verify HMAC-SHA256 signature on every incoming DOKU notification
- Validate `Client-Id` header matches merchant's Client ID
- Track processed `Request-Id`s to prevent replay attacks
- Respond 2xx immediately, process business logic asynchronously
- Use HTTPS endpoint for notification URL — never HTTP
