---
name: generate
description: Generate a DOKU payment API client. Auto-detects stack, fetches live spec, generates code. Use for any payment method.
argument-hint: [payment-method]
---

# /doku-codegen:generate

Invokes the **doku-codegen:setup-project** skill — the main entry point for all DOKU code generation.

Handles everything inline: detect stack → fetch API spec → collect credentials → generate files → validate output.

## $ARGUMENTS

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `payment-method` | string | No | Name or short code of the DOKU API to integrate. If omitted, guided mode asks which API. |

**Accepted values for `payment-method`:**
- `checkout` — Hosted checkout page (Non-SNAP, HMAC-SHA256)
- `va bni` / `virtual account bni` — BNI Virtual Account (SNAP, HMAC-SHA512)
- `va bri` — BRI Virtual Account (SNAP)
- `va mandiri` — Mandiri Virtual Account (SNAP)
- `qris` — QRIS QR payment (SNAP)
- `alfa` / `alfamart` — Alfa Group convenience store
- `indomaret` — Indomaret convenience store
- Any description → will be matched against developers.doku.com navigation

## Usage

```
/doku-codegen:generate                   ← guided mode, asks which API
/doku-codegen:generate checkout          ← generates Checkout client
/doku-codegen:generate va bni            ← generates BNI Virtual Account client
/doku-codegen:generate qris              ← generates QRIS client
```

## What it does

1. Loads `.claude/doku-codegen.local.md` — runs missing steps inline if anything is absent
2. Asks: add to existing project or full new project
3. Scans project layout to detect package structure (add-to-existing mode)
4. Shows exact file list for confirmation before writing anything
5. Dispatches to **sdk-generator** agent (Opus) for code writing
6. Chains to **integration-validator** agent (Sonnet) for 37-point quality check
7. Reports results with any blocking issues or auto-fixes applied

## Related agents

- `sdk-generator` — writes all code files (dispatched automatically)
- `integration-validator` — audits generated code (dispatched automatically)

## Related commands

- `/doku-codegen:spec [payment-method]` — fetch/refresh API spec only
- `/doku-codegen:test` — test the integration against sandbox
- `/doku-codegen:checklist` — production readiness check
- `/doku-codegen:postman` — generate Postman collection
- `/doku-codegen:save-session` — save progress to resume later
