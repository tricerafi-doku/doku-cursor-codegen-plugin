# Python Standards

Extends `coding.md` for Python-specific generated code.

## Language Version
- Python 3.8+ minimum
- Use type hints on all function signatures and class attributes
- Use f-strings for string formatting

## Package Manager
- Detect pip (requirements.txt), poetry (pyproject.toml with [tool.poetry]), or uv (pyproject.toml with [tool.uv])
- Add dependencies to the detected manifest

## HTTP Client
- **Async projects** (FastAPI, aiohttp): Use `httpx` with async support
- **Sync projects** (Flask, Django): Use `httpx` (sync mode) or `requests`
- Detect existing HTTP client from project dependencies

## DTOs / Models
- Use `dataclasses` with `@dataclass(frozen=True)` for immutable DTOs
- Or Pydantic `BaseModel` if project already uses Pydantic
- Amount fields: Use `Decimal` from `decimal` module, never `float`
- JSON serialization: `dataclasses.asdict()` or Pydantic `.model_dump()`

## Error Handling
- Custom exceptions:
  ```python
  class DokuApiError(Exception):  # base
  class DokuAuthError(DokuApiError):
  class DokuValidationError(DokuApiError):
  class DokuSignatureError(DokuApiError):
  class DokuNetworkError(DokuApiError):
  ```
- Include `request_id`, `response_code`, `message` as attributes
- Never catch bare `except:` — catch specific exception types

## Cryptography
- RSA: `cryptography` library (`cryptography.hazmat.primitives.asymmetric`)
- HMAC-SHA512/SHA256: `hmac` + `hashlib` from standard library
- SHA-256: `hashlib.sha256()`
- Base64: `base64.b64encode()` / `base64.b64decode()`
- Key loading: `cryptography.hazmat.primitives.serialization.load_pem_private_key()`

## Logging
- Use `logging` standard library module
- Structured logging via `extra` dict: `logger.info("API call", extra={"request_id": rid, "endpoint": path})`
- Configure with `logging.config.dictConfig()` or `structlog` if project uses it

## Testing
- Framework: `pytest`
- Mocking: `unittest.mock` or `pytest-mock`
- HTTP mocking: `respx` (for httpx) or `responses` (for requests) — **never call real DOKU sandbox in unit/integration tests**
- Async tests: `pytest-asyncio`
- Sandbox tests: Mark with `@pytest.mark.sandbox` — excluded from default run via `pytest -m "not sandbox"`
- Test file naming: `test_{module}.py`
- Fixtures for shared setup (client config, mock responses)
- Minimum coverage: 80% (`pytest --cov=src --cov-report=term-missing`)
- Static analysis: run `bandit -r src/` before committing — must produce zero HIGH findings

Required test cases:
```python
def test_computes_correct_hmac_signature(): ...
def test_generates_unique_request_id_per_call(): ...
def test_raises_doku_auth_error_on_401(): ...
def test_raises_doku_validation_error_on_400(): ...
# SNAP only:
def test_refreshes_expired_token_before_request(): ...
```

## Code Style
- Follow PEP 8 naming: `snake_case` for functions/variables, `PascalCase` for classes, `UPPER_CASE` for constants
- Line length: 120 characters (match common project configs)
- Imports: Group into standard library, third-party, local — use `isort` conventions

## Async Support
- If project uses async framework, generate async versions of all API calls
- Use `async with httpx.AsyncClient()` for connection management
- Token refresh: Use `asyncio.Lock` for thread-safe async token caching
