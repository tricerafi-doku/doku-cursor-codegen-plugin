# Node.js Standards

Extends `coding.md` for Node.js/TypeScript-specific generated code.

## Runtime Version
- Node.js 18+ minimum (LTS)
- Prefer TypeScript if project uses it (detected by tsconfig.json)
- Use ESM (`import/export`) if project uses `"type": "module"` in package.json, otherwise CommonJS

## Package Manager
- Detect npm (package-lock.json), yarn (yarn.lock), or pnpm (pnpm-lock.yaml)
- Add dependencies using the detected package manager

## HTTP Client
- **axios**: If project already uses it
- **node-fetch** or built-in `fetch` (Node 18+): For minimal-dependency projects
- **got**: If project uses it
- Detect from package.json dependencies

## TypeScript Support
- Generate `.ts` files if project has `tsconfig.json`
- Use strict types: interfaces for DTOs, enums for constants, union types for response codes
- Export all public types from index.ts
- Amount fields: Use `string` representation of decimals (avoid floating point)

## JavaScript Fallback
- Generate `.js` files with JSDoc type annotations for editor support
- Use class-based patterns for shared components

## DTOs / Models
- TypeScript: `interface` for request/response shapes, `readonly` fields
- Validation: Use Zod schemas if project uses Zod, otherwise manual validation
- JSON parsing: Use type guards or schema validation, not raw `JSON.parse()` + cast

## Error Handling
- Custom error classes extending `Error`:
  ```typescript
  class DokuApiError extends Error { requestId: string; responseCode: string; }
  class DokuAuthError extends DokuApiError {}
  class DokuValidationError extends DokuApiError {}
  class DokuSignatureError extends DokuApiError {}
  class DokuNetworkError extends DokuApiError {}
  ```
- Always set `error.cause` for chained errors
- Never catch without rethrowing or handling

## Cryptography
- Use Node.js built-in `crypto` module (no third-party crypto libraries):
  - RSA: `crypto.sign('SHA256', data, privateKey)`
  - HMAC-SHA512: `crypto.createHmac('sha512', key).update(data).digest('base64')`
  - HMAC-SHA256: `crypto.createHmac('sha256', key).update(data).digest('base64')`
  - SHA-256: `crypto.createHash('sha256').update(data).digest()`
  - Key loading: `crypto.createPrivateKey(pem)`

## Logging
- Use `console` with structured objects for simple projects
- Use `pino` or `winston` if project already has a logger
- Format: `logger.info({ requestId, endpoint, status }, 'DOKU API call completed')`
- Never `console.log()` raw objects in production code

## API Response Type

Use a consistent response wrapper for all DOKU client methods:
```typescript
interface DokuResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; requestId: string };
}
```

## Testing
- Framework: Jest or Vitest (detect from package.json devDependencies)
- HTTP mocking: `nock` (for Node HTTP), `msw` (for fetch/axios) — **never call real DOKU sandbox in unit/integration tests**
- Sandbox tests: use `describe.skip` or `.only` tag — keep separate from unit tests
- Test file naming: `{module}.test.ts` or `{module}.spec.ts` (match project convention)
- Use `beforeAll`/`afterAll` for setup/teardown
- Minimum coverage: 80% (`jest --coverage` or `vitest --coverage`)

Required test cases:
```typescript
it('computes correct HMAC signature', async () => { ... });
it('generates unique requestId per call', async () => { ... });
it('throws DokuAuthError on 401', async () => { ... });
it('throws DokuValidationError on 400', async () => { ... });
// SNAP only:
it('refreshes expired token before request', async () => { ... });
```

## Async Patterns
- All API calls return `Promise<T>`
- Use `async/await`, not raw Promise chains
- Token manager: Use mutex pattern for concurrent token refresh (e.g., `await-lock` or manual Promise caching)
- HTTP client: Reuse instance, configure timeout on creation
