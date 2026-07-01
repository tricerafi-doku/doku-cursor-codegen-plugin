# Python Standards

Extends `coding.md` for Python-specific generated code.

## Language Version
- Python 3.8+ minimum
- Use type hints on all function signatures and class attributes
- Use f-strings for string formatting

## Package Manager
- Detect pip (requirements.txt), poetry (pyproject.toml with [tool.poetry]), or uv (pyproject.toml with [tool.uv])
- Add dependencies to the detected manifest

## Configuration & Environment Variables

**Rule:** any generated code that reads `os.environ` at import-time or app-startup MUST explicitly load `.env` first. Python does NOT auto-load `.env`; without loading, `os.environ.get("DOKU_CLIENT_ID")` returns `""` and config validation fails immediately (e.g. `ValueError: DOKU_CLIENT_ID must not be empty`).

Pick exactly one of the two approaches below — never both.

### Approach A — `python-dotenv` (recommended when config uses `@dataclass` or plain `os.environ`)

1. Add to the dependency manifest:
   ```
   python-dotenv>=1.0.0
   ```
2. At the very top of every app entry point (`app/main.py`, `manage.py`, `wsgi.py`, CLI entrypoints), before any local imports that read env:
   ```python
   from dotenv import load_dotenv
   load_dotenv()
   ```
3. `load_dotenv()` looks for `.env` in CWD and walks up. This must run before `DokuConfig.from_env()` or equivalent — otherwise the config object is constructed with empty strings and `__post_init__` raises.

### Approach B — `pydantic-settings BaseSettings` (recommended when project already uses Pydantic)

1. Add to the dependency manifest:
   ```
   pydantic-settings>=2.0.0
   ```
2. Model config as a `BaseSettings` subclass — auto-loads `.env` from CWD:
   ```python
   from pydantic_settings import BaseSettings, SettingsConfigDict

   class DokuConfig(BaseSettings):
       model_config = SettingsConfigDict(env_file=".env", env_prefix="DOKU_", extra="ignore")

       client_id: str
       secret_key: str
       environment: str = "sandbox"
   ```
3. Instantiation `DokuConfig()` reads `.env` automatically — no `load_dotenv()` call needed.
4. **Do NOT also import `dotenv`** — the two approaches are alternatives, not additive.

### Enforcement

- The `post-write-python-check.js` hook flags any Python entry-point file that calls `os.environ.get(...)` on a DOKU_* variable when neither `load_dotenv` (Approach A) nor `pydantic_settings` (Approach B) appears in the same module or its transitively-imported config module.
- The `production-checklist` skill fails go-live if `.env` is referenced but no `.env` loading mechanism is wired up.

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
