---
name: postman
description: Generate a Postman collection for the integrated DOKU API with pre-request signature script.
---

# /doku-codegen:postman

Invokes the **doku-codegen:generate-postman** skill.

Generates a ready-to-import Postman collection with environment variables and a JavaScript pre-request script that computes the DOKU signature automatically (Non-SNAP HMAC-SHA256 or SNAP HMAC-SHA512 + B2B token flow).

## Usage

```
/doku-codegen:postman
```

## Output

Creates `doku-[api-name]-postman.json` in the current directory.

Import into Postman → set `DOKU_CLIENT_ID`, `DOKU_SECRET_KEY`, `DOKU_BASE_URL` environment variables → ready to test.
