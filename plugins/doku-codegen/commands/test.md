---
name: test
description: Send a test request to DOKU sandbox to verify signature and connectivity. Runs against the saved API spec.
---

# /doku-codegen:test

Invokes the **doku-codegen:mock-test** skill.

Builds a minimal valid request from the saved API spec, detects whether the local app is running, and either calls through it or directly hits DOKU sandbox with a computed signature.

## Usage

```
/doku-codegen:test
```

## What it checks

- Signature computation (HMAC-SHA256 or HMAC-SHA512 based on API spec)
- Credential validity (CLIENT_ID, SECRET_KEY)
- SNAP flow: B2B token acquisition + request signing
- Response parsing against saved RESPONSE_SCHEMA

## Output

- ✅ Success: shows key response fields (payment URL, VA number, QR code)
- ❌ 401: signature debugging tips
- ❌ 400: which field failed validation
- ❌ 5xx: DOKU sandbox error
