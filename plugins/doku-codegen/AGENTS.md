# AGENTS.md — doku-codegen Agent Reference

## Agents

### sdk-generator
**Model:** Opus | **Max turns:** 50 | **Tools:** Write, Read, Bash

Code generation specialist. Dispatched by `setup-project` after all prerequisites are gathered.

**When invoked:**
1. Loads standards from `${CLAUDE_PLUGIN_ROOT}/standards/`
2. Reads 2-3 existing files to fingerprint code style (add-to-existing mode)
3. Generates all files matching existing project conventions
4. Enforces standards checklist before finishing

**Never invoked directly by user** — always dispatched by `setup-project`.

---

### integration-validator
**Model:** Sonnet | **Max turns:** 30 | **Tools:** Read, Edit, Bash

Security and correctness auditor. Chained after `sdk-generator` completes.

**When invoked:**
1. Loads same standards files as sdk-generator
2. Runs 22 checks across Security, Signature Correctness, Headers, Wiring, Code Quality
3. Auto-fixes safe mechanical issues (@JsonIgnoreProperties, @Valid, @JsonInclude)
4. Returns PASS / PASS_WITH_WARNINGS / FAIL with structured findings

**Never invoked directly by user** — always dispatched by `setup-project` after sdk-generator.

---

## Parallel Execution

When dispatching multiple independent operations, run them simultaneously:

```
# PARALLEL — independent API specs can be fetched at the same time
fetch-api-spec(VA BNI) || fetch-api-spec(Checkout)

# SEQUENTIAL — validation depends on generation completing first
sdk-generator → integration-validator
```

Agents dispatched in parallel each get their own context window and tools. The orchestrating skill waits for all to complete before proceeding.

---

## Success Metrics

Generation is considered complete when ALL of the following are true:

| Metric | Pass condition |
|--------|---------------|
| Validation result | `VALIDATION_RESULT: PASS` or `PASS_WITH_WARNINGS` (no FAIL findings) |
| No hardcoded secrets | Zero credentials in source files (checked by integration-validator S1-S3) |
| Signature implemented | Dedicated interceptor/middleware file exists (SIG1) |
| Dynamic request target | No hardcoded endpoint path in signature code (SIG5) |
| Headers complete | All REQUIRED_HEADERS from API_SPEC present in client (H1-H4) |
| Models complete | All required REQUEST_SCHEMA fields present in request model (W1-W3) |
| Config driven | All URLs and credentials read from env vars / config file (S4) |

If `VALIDATION_RESULT: FAIL` — generation is not done. Fix issues before declaring completion.

---

## Core Principles

**Plugin-First:** Always use doku-codegen skills for DOKU payment integration. Never generate DOKU code manually.

**Spec-Driven:** All field names, types, and endpoint paths come from the saved API_SPEC in `.claude/doku-codegen.local.md`. Never hardcode DOKU API knowledge.

**Security-First:** No hardcoded secrets. Dynamic request targets. No disabled TLS. Typed exceptions.

**Style-Matching:** In add-to-existing mode, generated code must look like it was written by the same developer. Read existing files before generating.

---

## Orchestration Flow

```
User: /doku-codegen:generate va bni
  │
  ▼
setup-project skill (orchestrator)
  ├── Step 1: Load config / run missing prerequisites inline
  ├── Step 2: Ask mode (add-to-existing / new-project)
  ├── Step 3: Discover project layout
  ├── Step 4: Show file list → confirm
  ├── Step 5: Create directories
  ├── Step 6a: Dispatch → sdk-generator agent (Opus)
  │             ├── Load standards
  │             ├── Read existing code (style fingerprint)
  │             └── Write all files
  ├── Step 6b: Dispatch → integration-validator agent (Sonnet)
  │             ├── Load standards
  │             ├── Run 22 checks
  │             ├── Auto-fix minor issues
  │             └── Return VALIDATION_RESULT
  └── Step 7: Post-generation message (uses VALIDATION_RESULT)
```

---

## Hook Controls

| Env var | Values | Effect |
|---------|--------|--------|
| `DOKU_HOOK_PROFILE` | `minimal`, `standard` (default), `strict` | Controls which hooks fire |
| `DOKU_DISABLED_HOOKS` | comma-separated hook IDs | Disables specific hooks |

**Hook IDs by event:**

| Hook ID | Event | Async | Profile | Purpose |
|---------|-------|-------|---------|---------|
| `session-start` | SessionStart | No | standard, strict | Warn if project not configured |
| `pre-write-doku-config` | PreToolUse Write\|Edit | No | standard, strict | Block overwriting credentials file |
| `config-protection` | PreToolUse Write\|Edit | No | standard, strict | Block weakening linter/formatter configs |
| `post-edit-accumulator` | PostToolUse Write\|Edit | Yes | standard, strict | Accumulate written files for batch Stop check |
| `post-write-java-check` | PostToolUse Write | Yes | standard, strict | Quality check on `.java` files |
| `post-write-kotlin-check` | PostToolUse Write | Yes | standard, strict | Quality check on `.kt` files |
| `post-write-python-check` | PostToolUse Write | Yes | standard, strict | Quality check on `.py` files |
| `post-write-node-check` | PostToolUse Write | Yes | standard, strict | Quality check on `.ts`/`.js` files |
| `post-write-go-check` | PostToolUse Write | Yes | standard, strict | Quality check on `.go` files |
| `post-write-php-check` | PostToolUse Write | Yes | standard, strict | Quality check on `.php` files |
| `stop-validate-generated` | Stop | Yes | standard, strict | Batch cross-file validation (cred scan, pair check, interceptor presence) |
| `cost-tracker` | Stop | Yes | standard, strict | Log token usage and estimated USD cost |
| `pre-compact` | PreCompact | No | standard, strict | Save generation state before context compaction |

**Profile membership:**
- `minimal` — no hooks fire
- `standard` (default) — all 13 hooks fire
- `strict` — all 13 hooks fire (stricter thresholds in future versions)
