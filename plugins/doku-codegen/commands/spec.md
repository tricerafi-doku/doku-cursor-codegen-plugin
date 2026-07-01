---
name: spec
description: Fetch and save a DOKU API spec from developers.doku.com. Use to load or refresh the spec before generating code.
argument-hint: [payment-method]
---

# /doku-codegen:spec

Invokes the **doku-codegen:fetch-api-spec** skill.

Navigates developers.doku.com via sitemap, extracts the full API spec including auth prerequisites, and saves to `.claude/doku-codegen.local.md`.

## Usage

```
/doku-codegen:spec                  ← guided, asks which API
/doku-codegen:spec bni              ← fetch BNI Virtual Account spec
/doku-codegen:spec checkout         ← fetch Checkout spec
/doku-codegen:spec qris             ← fetch QRIS spec
```

## When to use

- Before running `/doku-codegen:generate` on a new payment method
- When DOKU updates their API and you need the latest spec
- To preview what fields/endpoints an API has before generating code
