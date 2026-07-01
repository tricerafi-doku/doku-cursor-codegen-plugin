# Go Standards

Extends `coding.md` for Go-specific generated code.

## Language Version
- Go 1.22+ minimum
- Use go modules (`go.mod`) for dependency management

## HTTP Client
- Use `net/http` standard library (Go's HTTP client is production-grade)
- Create reusable `*http.Client` with configured timeouts and transport
- Use `context.Context` for request cancellation and deadlines

## DTOs / Models
- Use structs with exported fields and `json` struct tags
- Amount fields: Use `string` representation or custom `Amount` type (avoid `float64`)
- JSON: `encoding/json` standard library
- Use `json:",omitempty"` for optional fields
- Use pointer types for nullable fields: `*string`, `*int64`

## Error Handling
- Use Go's error wrapping pattern:
  ```go
  var (
      ErrDokuAuth       = errors.New("doku: authentication failed")
      ErrDokuValidation = errors.New("doku: validation failed")
      ErrDokuSignature  = errors.New("doku: signature verification failed")
      ErrDokuNetwork    = errors.New("doku: network error")
      ErrDokuApi        = errors.New("doku: api error")
  )
  ```
- Wrap errors with context: `fmt.Errorf("create VA failed: %w", err)`
- Custom error type with `RequestId` and `ResponseCode` fields
- Always check returned errors — never use `_` for error returns

## Cryptography
- RSA: `crypto/rsa` + `crypto/x509` for key parsing, `crypto.SHA256` for signing
- HMAC-SHA512: `crypto/hmac` + `crypto/sha512`
- HMAC-SHA256: `crypto/hmac` + `crypto/sha256`
- SHA-256: `crypto/sha256`
- Base64: `encoding/base64`
- Key loading: `x509.ParsePKCS8PrivateKey()` from PEM block
- All crypto uses standard library — no third-party crypto packages

## Logging
- Use `log/slog` (Go 1.21+) for structured logging
- Format: `slog.Info("DOKU API call", "request_id", rid, "endpoint", path, "status", code)`
- For older Go versions: `log` package with structured string format
- If project uses `zerolog` or `zap`, use that instead

## Context and Timeouts

Always accept and propagate `context.Context` — never use `context.Background()` inside library functions:
```go
func (c *Client) CreateVA(ctx context.Context, req *CreateVARequest) (*CreateVAResponse, error) {
    httpReq, _ := http.NewRequestWithContext(ctx, "POST", url, body)
    ...
}
```
Caller sets the deadline; the library never overrides it. Default timeout lives in the HTTP client config, not inside each method.

## Security Scanning
- Run `gosec ./...` before committing — must produce zero HIGH/CRITICAL findings
- Run `go vet ./...` — zero warnings

## Testing
- Framework: `testing` standard library
- HTTP mocking: `net/http/httptest.NewServer()` for mock DOKU server — **never call real DOKU sandbox in unit/integration tests**
- Table-driven tests for multiple scenarios (success, 401, 400, timeout)
- Sandbox tests: Use build tags `//go:build sandbox` — excluded from default `go test ./...`
- Test file naming: `{file}_test.go` in same package
- Use `testify/assert` if project already uses it, otherwise standard `testing`
- Minimum coverage: 80% (`go test -cover ./...`)
- Race detection: always run `go test -race ./...` in CI

Required test cases:
```go
func TestComputeCorrectHMACSignature(t *testing.T) { ... }
func TestUniqueRequestIDPerCall(t *testing.T) { ... }
func TestReturnsAuthErrorOn401(t *testing.T) { ... }
func TestReturnsValidationErrorOn400(t *testing.T) { ... }
// SNAP only:
func TestRefreshesExpiredTokenBeforeRequest(t *testing.T) { ... }
func TestConcurrentRequestsOnlyOneTokenRefresh(t *testing.T) { ... }
```

## Code Style
- Follow `gofmt` / `goimports` formatting (non-negotiable in Go)
- Naming: `CamelCase` exported, `camelCase` unexported, acronyms all-caps (`URL`, `HTTP`, `ID`)
- Package naming: Short, lowercase, single-word (e.g., `doku`, `signature`, `payment`)
- Interfaces: Single-method interfaces where possible, named by method (`Signer`, `TokenProvider`)

## Concurrency
- Token cache: Use `sync.Mutex` or `sync.RWMutex` for thread-safe access
- HTTP client: `*http.Client` is safe for concurrent use — create once, reuse
- Context propagation: Pass `context.Context` as first parameter to all public functions
- Use `sync.Once` for one-time initialization

## Project Layout
- Follow standard Go project layout:
  ```
  doku/
  ├── client.go          # Main DOKU client
  ├── signature.go       # Signature generator
  ├── token.go           # Token manager
  ├── config.go          # Configuration
  ├── errors.go          # Error types
  ├── models.go          # Shared DTOs
  ├── va.go              # Virtual Account API
  ├── card.go            # Credit Card API
  └── *_test.go          # Tests alongside source
  ```
- Single package for simple integrations, sub-packages for complex ones
