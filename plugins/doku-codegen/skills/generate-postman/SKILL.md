---
name: generate-postman
description: Generate a ready-to-import Postman collection for the integrated DOKU API. Use when the user says "generate Postman collection", "create Postman for DOKU", or "export to Postman". Reads the saved API spec and credentials from config to build request headers, body, and signature pre-request script automatically.
tools: Write, Read
origin: doku-codegen
---

# doku-codegen — Generate Postman Collection

Generate a Postman collection JSON file with signature pre-request script, ready to import.

---

## Step 1: Load Config

```bash
cat .claude/doku-codegen.local.md 2>/dev/null || echo "FILE_NOT_FOUND"
```

If config missing → stop:
```
❌ Config not found. Run /doku-codegen:fetch-api-spec and /doku-codegen:setup-credentials first.
```

If `API_SPEC` is missing → stop:
```
❌ No API spec found. Run /doku-codegen:fetch-api-spec first.
```

Extract:
- `API_SPEC.API_NAME`
- `API_SPEC.API_ENDPOINT` — method + path
- `API_SPEC.REQUIRED_HEADERS`
- `API_SPEC.REQUEST_SCHEMA`
- `API_SPEC.SIGNATURE_ALGORITHM`
- `API_SPEC.AUTH_NOTES`
- `CLIENT_ID`, `SECRET_KEY`, `BASE_URL`

Derive `API_SLUG` from API_NAME: lowercase, replace spaces with hyphens (e.g. "Checkout" → "checkout", "Virtual Account BRI" → "virtual-account-bri").

Output file: `doku-[API_SLUG]-postman.json` in current directory.

---

## Step 2: Build Pre-Request Script

Determine signature type from `API_SPEC.SIGNATURE_ALGORITHM`:

**Non-SNAP (HMAC-SHA256):**
```javascript
// Postman Pre-Request Script — DOKU Non-SNAP Signature (HMAC-SHA256)
const clientId  = pm.environment.get("DOKU_CLIENT_ID");
const secretKey = pm.environment.get("DOKU_SECRET_KEY");
const requestId = require('uuid').v4();
const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

pm.environment.set("REQUEST_ID", requestId);
pm.environment.set("REQUEST_TIMESTAMP", timestamp);

const body = pm.request.body ? pm.request.body.raw || "" : "";
const bodyBytes = CryptoJS.enc.Utf8.parse(body);
const digest    = CryptoJS.enc.Base64.stringify(CryptoJS.SHA256(bodyBytes));

const endpoint  = pm.request.url.getPath();
const signingString = [
    `Client-Id:${clientId}`,
    `Request-Id:${requestId}`,
    `Request-Timestamp:${timestamp}`,
    `Request-Target:${endpoint}`,
    `Digest:${digest}`
].join("\n");

const sig = CryptoJS.enc.Base64.stringify(
    CryptoJS.HmacSHA256(signingString, secretKey)
);
pm.environment.set("DOKU_SIGNATURE", "HMACSHA256=" + sig);
```

**SNAP (HMAC-SHA512):**
```javascript
// Postman Pre-Request Script — DOKU SNAP Signature (HMAC-SHA512 + B2B token)
// Step 1: Get B2B access token (chained pre-request)
const clientId   = pm.environment.get("DOKU_CLIENT_ID");
const privateKey = pm.environment.get("DOKU_PRIVATE_KEY");
const tokenEndpoint = pm.environment.get("DOKU_BASE_URL") + "/snap/v1/access-token/b2b";

// Compute RSA-SHA256 string-to-sign for token request
const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
pm.environment.set("REQUEST_TIMESTAMP", timestamp);

const tokenSigningString = `${clientId}|${timestamp}`;
// Use forge or CryptoJS RSA (requires Postman sandbox)
// Note: set DOKU_PRIVATE_KEY as PEM string in environment
const tokenSig = pm.variables.get("DOKU_TOKEN_SIGNATURE"); // pre-computed

pm.sendRequest({
    url: tokenEndpoint,
    method: "POST",
    header: {
        "Content-Type": "application/json",
        "X-CLIENT-KEY": clientId,
        "X-TIMESTAMP": timestamp,
        "X-SIGNATURE": tokenSig
    },
    body: { mode: "raw", raw: JSON.stringify({ grantType: "client_credentials" }) }
}, (err, res) => {
    if (!err) {
        pm.environment.set("DOKU_ACCESS_TOKEN", res.json().accessToken);
    }
});

// Step 2: Compute HMAC-SHA512 for the actual request
const requestId  = require('uuid').v4();
const httpMethod = pm.request.method.toUpperCase();
const endpoint   = pm.request.url.getPath();
const body       = pm.request.body ? pm.request.body.raw || "" : "";
const bodyHash   = CryptoJS.enc.Base64.stringify(CryptoJS.SHA256(CryptoJS.enc.Utf8.parse(body))).toLowerCase();
const accessToken = pm.environment.get("DOKU_ACCESS_TOKEN");
const secretKey   = pm.environment.get("DOKU_SECRET_KEY");

pm.environment.set("REQUEST_ID", requestId);

const snapSigning = `${httpMethod}:${endpoint}:${accessToken}:${bodyHash}:${timestamp}`;
const snapSig = CryptoJS.enc.Base64.stringify(
    CryptoJS.HmacSHA512(snapSigning, secretKey)
);
pm.environment.set("DOKU_SIGNATURE", snapSig);
```

---

## Step 3: Build Collection JSON

Build a valid Postman Collection v2.1 JSON:

- Collection name: `DOKU [API_NAME]`
- Environment variables (set at collection level):
  - `DOKU_BASE_URL` = `{{BASE_URL}}`
  - `DOKU_CLIENT_ID` = `{{CLIENT_ID}}`
  - `DOKU_SECRET_KEY` = `{{SECRET_KEY}}`
  - If SNAP: `DOKU_PRIVATE_KEY` = `<paste RSA private key PEM>`
  - `REQUEST_ID` = (computed by pre-request script)
  - `REQUEST_TIMESTAMP` = (computed by pre-request script)
  - `DOKU_SIGNATURE` = (computed by pre-request script)

- One request item derived from API_SPEC:
  - Name: `[API_NAME] — [API_ENDPOINT]`
  - Method + URL: from `API_SPEC.API_ENDPOINT`
  - Pre-request script: the script from Step 2
  - Headers (from `API_SPEC.REQUIRED_HEADERS`):
    - `Content-Type: application/json`
    - `Client-Id: {{DOKU_CLIENT_ID}}`
    - `Request-Id: {{REQUEST_ID}}`
    - `Request-Timestamp: {{REQUEST_TIMESTAMP}}`
    - `Signature: {{DOKU_SIGNATURE}}`
    - Any additional headers from REQUIRED_HEADERS
  - Request body: JSON object with all required fields from `API_SPEC.REQUEST_SCHEMA` using test values:
    - Monetary fields → `10000`
    - Invoice/reference fields → `"TEST-001"`
    - String enums → first valid value
    - Other required strings → `"test"`

---

## Step 4: Write Collection File

Write to `doku-[API_SLUG]-postman.json` in current directory.

---

## Step 5: Confirm

Print:
```
✅ Postman collection saved: doku-[API_SLUG]-postman.json

To use:
  1. Open Postman → Import → select doku-[API_SLUG]-postman.json
  2. Set environment variables:
       DOKU_CLIENT_ID  = your Client-Id
       DOKU_SECRET_KEY = your Secret Key
       DOKU_BASE_URL   = https://api-sandbox.doku.com
       [if SNAP] DOKU_PRIVATE_KEY = <your RSA private key PEM>
  3. Send the request — signature is computed automatically by the pre-request script
```
