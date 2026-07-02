---
name: mock-test
description: Send a test request to DOKU sandbox using stored credentials. Use when the user says "test DOKU integration", "run mock test", "verify DOKU connection", or "test sandbox". Reads API_SPEC from config to build the correct test request dynamically.
tools: Bash, Read
origin: doku-codegen
---

# doku-codegen — Mock Test

Send a minimal test request to DOKU sandbox to verify signature and connectivity.

---

## Step 1: Load Config

```bash
cat .claude/doku-codegen.local.md 2>/dev/null || echo "FILE_NOT_FOUND"
```

If missing → print error and stop:
```
❌ Config not found. Run /doku-codegen:setup-credentials and /doku-codegen:fetch-api-spec first.
```

Extract from config:
- `CLIENT_ID`
- `SECRET_KEY`
- `BASE_URL` (or derive from ENVIRONMENT)

**Select the active spec.** If the user specified an API (e.g. "test checkout") use that slug; otherwise if only one entry exists in `API_SPECS`, use it. Fall back to the legacy top-level `API_SPEC` only when `API_SPECS` is absent.

- Prefer: `API_SPECS[<slug>].API_ENDPOINT` — e.g. `POST /checkout/v1/payment`
- Prefer: `API_SPECS[<slug>].ENDPOINTS[0]` if `API_ENDPOINT` is not set
- Prefer: `API_SPECS[<slug>].REQUEST_SCHEMA` — to build minimal valid body
- Prefer: `API_SPECS[<slug>].SIGNATURE_ALGORITHM`
- Fallback (legacy configs only): `API_SPEC.API_ENDPOINT`, `API_SPEC.REQUEST_SCHEMA`, `API_SPEC.SIGNATURE_ALGORITHM`

If `API_SPECS` has multiple entries and the user did not name one, ask which API to test before proceeding — do not silently pick the last-fetched.

---

## Step 2: Build Test Request

Parse `API_SPEC.API_ENDPOINT`:
- HTTP method (e.g. `POST`)
- Path (e.g. `/checkout/v1/payment`)

Derive local app path: strip version and last segment for controller route (e.g. `/checkout/v1/payment` → `/checkout`).

Build minimal valid request body from `API_SPEC.REQUEST_SCHEMA` required fields, using test values:
- Amount/monetary fields → `10000`
- Invoice/reference fields → `TEST-001`
- String enum fields → first valid value from schema
- Other required strings → `"test"`

---

## Step 3: Detect Running App or Test Directly

Derive `LOCAL_PORT` and `LOCAL_HEALTH_PATH` from `LANGUAGE` / `FRAMEWORK` in config:

| Stack | Default port | Default health path |
|---|---|---|
| Java / Kotlin (Spring Boot) | 8080 | `/actuator/health` |
| Python / FastAPI | 8000 | `/health` (or `/docs` as fallback if `/health` not defined) |
| Python / Flask | 5000 | `/health` (or `/`) |
| Python / Django | 8000 | `/` |
| Node.js / Express | 3000 | `/health` (or `/`) |
| Node.js / NestJS | 3000 | `/health` |
| Go / Gin | 8080 | `/health` |
| PHP / Laravel | 8000 | `/` |

If the config stores a custom port under `LOCAL_PORT`, prefer that over the table default.

Check if the app is running:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:[LOCAL_PORT][LOCAL_HEALTH_PATH] 2>/dev/null || echo "NOT_RUNNING"
```

**If app is running → call through local app:**
```bash
curl -s -X [METHOD] http://localhost:[PORT][LOCAL_PATH] \
  -H "Content-Type: application/json" \
  -d '[TEST_BODY]'
```
(App handles signature internally.)

**If app is not running → call DOKU sandbox directly via Python:**

Generate and run a Python script using stdlib only (no pip installs):
```bash
python3 - <<'EOF'
import json, hmac, hashlib, base64, uuid, urllib.request
from datetime import datetime, timezone

client_id  = "[CLIENT_ID]"
secret_key = "[SECRET_KEY]"
base_url   = "[BASE_URL]"
endpoint   = "[API_ENDPOINT_PATH]"
body       = json.dumps([TEST_BODY_DICT], separators=(',', ':'))

request_id = str(uuid.uuid4())
timestamp  = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

digest = base64.b64encode(hashlib.sha256(body.encode()).digest()).decode()
signing = "\n".join([
    f"Client-Id:{client_id}",
    f"Request-Id:{request_id}",
    f"Request-Timestamp:{timestamp}",
    f"Request-Target:{endpoint}",
    f"Digest:{digest}"
])
sig = base64.b64encode(hmac.new(secret_key.encode(), signing.encode(), hashlib.sha256).digest()).decode()

req = urllib.request.Request(
    f"{base_url}{endpoint}",
    data=body.encode(),
    headers={
        "Content-Type": "application/json",
        "Client-Id": client_id,
        "Request-Id": request_id,
        "Request-Timestamp": timestamp,
        "Signature": f"HMACSHA256={sig}"
    },
    method="POST"
)
try:
    with urllib.request.urlopen(req) as r:
        print(r.read().decode())
except urllib.error.HTTPError as e:
    print(f"HTTP {e.code}:", e.read().decode())
EOF
```

For SNAP APIs (HMAC-SHA512), adjust the script to use sha512 and include the B2B token flow per API_SPEC.AUTH_NOTES.

---

## Step 4: Evaluate and Report

Parse the response and print one of:

**✅ Success:**
```
✅ Connection verified!

Key response fields:
  [field names from API_SPEC.RESPONSE_SCHEMA.success — e.g. payment_url, va_number, qr_string]

Run /doku-codegen:production-checklist before going live.
```

**❌ 401 Signature error:**
```
❌ Signature verification failed (HTTP 401)

Debugging tips:
  1. Check CLIENT_ID matches the one in DOKU Back Office
  2. Check SECRET_KEY — no extra spaces or newlines
  3. Verify clock sync: request timestamp must be within 5 minutes of server time
  4. Re-run /doku-codegen:setup-credentials to update credentials
```

**❌ 400 Validation error:**
```
❌ Request validation failed (HTTP 400)
   Error: [error_messages from response]

Fix: check required fields in API_SPEC.REQUEST_SCHEMA
```

**❌ Connection refused (app not running, direct call path not used):**
```
❌ App not running on port [PORT].
   Start it first: [run command for the language], then re-run /doku-codegen:mock-test
```

**❌ 5xx:**
```
❌ DOKU sandbox error (HTTP [code])
   Response: [body]

This is a DOKU-side error. Try again in a moment or check https://status.doku.com
```
