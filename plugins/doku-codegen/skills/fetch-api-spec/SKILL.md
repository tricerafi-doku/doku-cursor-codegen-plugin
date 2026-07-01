---
name: fetch-api-spec
description: Fetch and parse a DOKU API spec from developers.doku.com, then save to .claude/doku-codegen.local.md. Use when the user says "fetch DOKU API spec", "load API documentation", "refresh API spec", "get the spec for [payment method]", or "which DOKU APIs are available". Also use when the user names a specific DOKU payment method and wants to know its API details before generating code. Can also be called inline by setup-project when no spec is saved yet.
tools: WebFetch, Read, Write, AskUserQuestion
origin: doku-codegen
---

# doku-codegen — Fetch API Spec

Navigate developers.doku.com dynamically to find any DOKU API spec, follow prerequisite cross-references, and save the complete spec to `.claude/doku-codegen.local.md`.

**Key principle:** developers.doku.com is JS-rendered (GitBook) — the root page HTML does not contain navigation links. Always start from the sitemap to discover URLs, then fetch the specific page directly.

**NEVER use training knowledge as a substitute for fetching.** Even if you know the DOKU Checkout or Virtual Account spec from training data, that data may be outdated. Always fetch `https://developers.doku.com/sitemap-pages.xml` first.

If the user's message already names the API, skip the question in Step 1 and use that keyword directly to match against the sitemap.

---

## Step 1: Ask Which DOKU API (AskUserQuestion)

Ask with these options:
1. "Checkout — hosted payment page, 25+ methods (Non-SNAP, HMAC-SHA256)"
2. "Virtual Account — bank transfer (SNAP, HMAC-SHA512 + B2B token)"
3. "QRIS — QR scan-to-pay (SNAP, HMAC-SHA512 + B2B token)"
4. "Convenience Store — Alfamart / Indomaret (Non-SNAP)"
5. "Other — type a payment method name or paste a URL"

Store as USER_API_CHOICE.

---

## Step 2: Discover URL via Sitemap

**Always start from the sitemap — never the root page (it is JS-rendered and has no navigable links):**

```
Fetch: https://developers.doku.com/sitemap-pages.xml
```

From the sitemap, find all URLs that match USER_API_CHOICE by keyword:
- "checkout" → URLs containing `checkout`
- "virtual account" / "va" / bank name (bni, bri, mandiri, etc.) → URLs containing `virtual-account` + bank name
- "qris" → URLs containing `qris`
- "convenience store" / "alfamart" → URLs containing `convenience-store` or `alfa`
- "indomaret" → URLs containing `indomaret`
- For "Other": keyword-match against the user's description

Pick the most specific, non-archive URL (avoid `/archive/` paths unless no other match exists).

**If user pasted a URL directly:**
- Use it as-is if it starts with `https://developers.doku.com/`
- Otherwise use it directly but note the external source in SPEC_SOURCE_URL

**If no match found in sitemap:**
- Broaden keywords and retry once
- If still not found, tell the user and offer manual spec input as fallback

---

## Step 3: Fetch and Extract Spec

Fetch the target page. Extract whatever API information is present — best-effort, LLM-driven extraction:

- `API_NAME` — name of the API or endpoint
- `API_ENDPOINT` — HTTP method + path (e.g. `POST /checkout/v1/payment`)
- `BASE_URL` — sandbox and/or production server URLs from the page
- `REQUIRED_HEADERS` — all headers listed, including auth/signature headers
- `REQUEST_SCHEMA` — request body fields with types, constraints, required/optional status
- `RESPONSE_SCHEMA` — success and error response structure
- `SIGNATURE_ALGORITHM` — algorithm described (e.g. HMAC-SHA256, HMAC-SHA512, RSA-SHA256)
- `AUTH_NOTES` — extra auth steps (e.g. "B2B token required", "obtain access token first")
- `EXAMPLES` — request/response examples found on the page

---

## Step 3b: Follow Prerequisite Cross-References

After scraping the main page, scan the extracted content for prerequisite references — phrases like:
- "see authentication guide"
- "refer to SNAP auth"
- "get access token first"
- "B2B token required"
- Links labeled "Authentication", "Authorization", "Signature", "Access Token", "Pre-requisite", "Getting Started"

For each prerequisite reference found:
1. If it's a link on `developers.doku.com` → fetch that page and extract additional spec fields.
2. Merge prerequisite info into the spec — especially auth flow, token endpoint, additional headers, RSA key requirements.
3. Tag each merged field with its source URL for traceability (append `[source: <url>]` to the field value).

**Example:** Virtual Account BRI page references SNAP B2B token auth on a separate page. Fetch that page, extract the token endpoint and RSA signature algorithm, and merge into the saved spec so `setup-project` can generate complete auth code.

If a prerequisite page is unreachable → include the reference URL in `AUTH_NOTES` so the user can check manually.

---

## Step 4: Archive Previous Spec and Save New One

**Read existing config first:**
```bash
cat .claude/doku-codegen.local.md 2>/dev/null || echo "FILE_NOT_FOUND"
```

If the config file has an existing `API_SPEC` section → rename it to `API_SPEC_PREVIOUS` before saving (used by the `upgrade` skill to diff changes).

**Write updated config immediately — do not hold spec in memory.** Preserve all existing fields (LANGUAGE, FRAMEWORK, CLIENT_ID, SECRET_KEY, etc.) and add/replace:

```
API_SPEC:
  API_NAME: <value>
  API_ENDPOINT: <HTTP method + path>
  BASE_URL:
    sandbox: <sandbox URL from page>
    production: <production URL from page>
  REQUIRED_HEADERS:
    - <header name>: <description>
  REQUEST_SCHEMA:
    - field: <name>
      type: <type>
      required: <true/false>
      description: <description>
  RESPONSE_SCHEMA:
    success:
      - field: <name>
        type: <type>
        description: <description>
    error:
      - field: <name>
        type: <type>
        description: <description>
  SIGNATURE_ALGORITHM: <e.g. HMAC-SHA256>
  AUTH_NOTES: <extra auth steps or empty>
  EXAMPLES:
    request: <example JSON or empty>
    response: <example JSON or empty>

SPEC_SOURCE_URL: <URL(s) fetched, comma-separated>
SPEC_FETCHED_AT: <ISO 8601 timestamp>
```

If there was a previous spec, also write:
```
API_SPEC_PREVIOUS:
  <copy of old API_SPEC content>
```

---

## Step 5: Confirm

Print:
```
✅ API spec saved: [API_NAME]
   Endpoint: [API_ENDPOINT]
   Source: [SPEC_SOURCE_URL]
   Prerequisite pages followed: [N]

Run /doku-codegen:setup-project to generate client code.
```

If any prerequisite pages were unreachable, list them with a warning so the user can check manually.
