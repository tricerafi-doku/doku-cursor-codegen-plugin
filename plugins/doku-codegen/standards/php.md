# PHP Standards

Extends `coding.md` for PHP-specific generated code.

## Language Version
- PHP 7.4+ minimum (typed properties)
- Use type declarations on all parameters and return types
- Use arrow functions where appropriate (PHP 7.4+)

## Package Manager
- Composer (composer.json) — the only PHP package manager
- Add dependencies to `require` section
- Use PSR-4 autoloading

## HTTP Client
- **Guzzle** (guzzlehttp/guzzle): Default and most common
- **Symfony HttpClient**: If project uses Symfony
- **Laravel Http**: If project uses Laravel (wrapper around Guzzle)
- Detect from composer.json

## DTOs / Models
- Use classes with typed properties and constructor promotion (PHP 8.0+)
- For PHP 7.4: Classes with typed properties and explicit constructor
- Amount fields: Use `string` with `bcmath` functions, never `float`
- JSON serialization: Implement `JsonSerializable` interface
- Use `readonly` properties (PHP 8.1+) if project supports it

## Error Handling
- Custom exceptions extending `\RuntimeException`:
  ```php
  class DokuApiException extends \RuntimeException { /* requestId, responseCode */ }
  class DokuAuthException extends DokuApiException {}
  class DokuValidationException extends DokuApiException {}
  class DokuSignatureException extends DokuApiException {}
  class DokuNetworkException extends DokuApiException {}
  ```
- Include `requestId` and `responseCode` as properties
- Never catch generic `\Exception` without rethrowing

## Cryptography
- RSA: `openssl_sign()` with `OPENSSL_ALGO_SHA256`
- HMAC-SHA512: `hash_hmac('sha512', $data, $key)`
- HMAC-SHA256: `hash_hmac('sha256', $data, $key)`
- SHA-256: `hash('sha256', $data)`
- Base64: `base64_encode()` / `base64_decode()`
- Key loading: `openssl_pkey_get_private($pem, $passphrase)`

## Logging
- Use PSR-3 `LoggerInterface` (Monolog is the standard implementation)
- Structured context: `$logger->info('DOKU API call', ['request_id' => $rid, 'endpoint' => $path])`
- Laravel: Use `Log::info()` facade
- Never use `echo`, `print_r()`, or `var_dump()` for logging

## Testing
- Framework: PHPUnit (standard for all PHP projects)
- Mocking: PHPUnit mocks or Mockery
- HTTP mocking: `php-http/mock-client` or Guzzle MockHandler
- Sandbox tests: Use `@group sandbox` annotation
- Test file naming: `{ClassName}Test.php`
- Test directory: `tests/` mirroring `src/` structure

## Code Style
- Follow PSR-12 coding standard
- Naming: `camelCase` methods, `PascalCase` classes, `UPPER_SNAKE_CASE` constants
- Namespace: Match vendor/package structure (e.g., `Doku\Payment\VirtualAccount`)
- Use strict types: `declare(strict_types=1);` at top of every file

## Framework Integration
- **Laravel**: Generate as a service provider with config publishing, use Facades where appropriate
- **Symfony**: Generate as a bundle with DI configuration
- **Plain PHP**: Generate standalone classes with Composer autoloading
