---
name: fetch-api-spec
description: Fetch and parse a DOKU API spec from developers.doku.com, then save to .claude/doku-codegen.local.md. Use when the user says "fetch DOKU API spec", "load API documentation", "refresh API spec", "get the spec for [payment method]", or "which DOKU APIs are available". Also use when the user names a specific DOKU payment method and wants to know its API details before generating code. Can also be called inline by setup-project when no spec is saved yet.
tools: WebFetch, Read, Write, AskUserQuestion
origin: doku-codegen
---

# doku-codegen — Fetch API Spec

Navigate developers.doku.com dynamically to find any DOKU API spec, follow prerequisite cross-references, and save the complete spec to `.claude/doku-codegen.local.md`.

**Key principle:** DOKU now ships agent-native docs. Prefer `llms.txt` as the discovery index and `<url>.md` for clean-markdown page content. `sitemap-pages.xml` is a last-resort fallback (older, sometimes returns binary content).

**NEVER use training knowledge as a substitute for fetching.** Even if you know the DOKU Checkout or Virtual Account spec from training data, that data may be outdated. Always fetch live.

If the user's message already names the API, skip the question in Step 1 and use that keyword directly.

---

## Step 1: Ask Which DOKU API (AskUserQuestion)

Ask with these options:
1. "Checkout — hosted payment page, 25+ methods (Non-SNAP, HMAC-SHA256)"
2. "Virtual Account — bank transfer (SNAP, HMAC-SHA512 + B2B token)"
3. "QRIS — QR scan-to-pay (SNAP, HMAC-SHA512 + B2B token)"
4. "Convenience Store — Alfamart / Indomaret (Non-SNAP)"
5. "Other — type a payment method name or paste a URL"

Store as USER_API_CHOICE. Derive `API_SLUG` from the chosen option (kebab-case: `checkout`, `virtual-account`, `qris`, `convenience-store`, or a slug derived from the "Other" text).

---

## Step 2: Discover URL (agent-native → sitemap fallback)

Try the sources in order. Move to the next only if the previous is unavailable or returns unusable content.

### 2a. Primary — `llms.txt` index

```
Fetch: https://developers.doku.com/llms.txt
```

Parse the returned index (Markdown list of `- [title](url) — description`). Keyword-match against `USER_API_CHOICE` on the title and description. Pick the most specific, non-archive URL.

### 2b. Fetch clean Markdown for the target URL

For any URL discovered from `llms.txt`, prefer the `.md` variant:

```
Fetch: <matched-url>.md
```

DOKU serves clean Markdown at the `.md` suffix — no JS render required, no GitBook HTML noise.

Optional refinement — targeted question query for header/schema extraction:

```
Fetch: <matched-url>.md?ask=list+required+headers+and+request+schema
```

Use this only when the top-level `.md` content is ambiguous or omits schema tables.

### 2c. Fallback — sitemap-pages.xml (if 2a is unavailable)

```
Fetch: https://developers.doku.com/sitemap-pages.xml
```

From the sitemap, find URLs that match `USER_API_CHOICE` by keyword:
- "checkout" → URLs containing `checkout`
- "virtual account" / "va" / bank name (bni, bri, mandiri, etc.) → URLs containing `virtual-account` + bank name
- "qris" → URLs containing `qris`
- "convenience store" / "alfamart" → URLs containing `convenience-store` or `alfa`
- "indomaret" → URLs containing `indomaret`

Pick the most specific, non-archive URL (avoid `/archive/` paths unless no other match exists). Then apply Step 2b (`.md` suffix) to that URL.

**If the user pasted a URL directly:**
- Use it as-is if it starts with `https://developers.doku.com/`
- Try `<pasted-url>.md` first for clean content

**If nothing matches after both paths:**
- Tell the user which sources you tried and offer manual spec input as fallback

---

## Step 3: Extract Spec Fields

Extract whatever API information is present from the fetched Markdown — best-effort, LLM-driven extraction:

- `API_NAME` — name of the API
- `ENDPOINTS` — **list** of `{method, path, name}` covering every operation on the page (e.g. create / inquiry / status / delete). This is the canonical field consumed by `sdk-generator` and `integration-validator`.
- `API_ENDPOINT` — alias for `ENDPOINTS[0].method + " " + ENDPOINTS[0].path` (kept for backward-compat).
- `BASE_URL` — sandbox and/or production server URLs from the page
- `REQUIRED_HEADERS` — all headers listed, including auth/signature headers
- `REQUEST_SCHEMA` — request body fields with types, constraints, required/optional status
- `RESPONSE_SCHEMA` — success and error response structure
- `SIGNATURE_ALGORITHM` — algorithm described (e.g. HMAC-SHA256, HMAC-SHA512, RSA-SHA256)
- `SIGNATURE_TYPE` — **derived**: `SNAP` if `SIGNATURE_ALGORITHM` starts with `RSA-` or equals `HMAC-SHA512`, or if the page mentions "SNAP" / "B2B token" / a `/authorization/v1/access-token/b2b` endpoint. Otherwise `NON_SNAP`.
- `TOKEN_ENDPOINT` — the B2B token acquisition endpoint if the API is SNAP (typically `/authorization/v1/access-token/b2b`). Empty for Non-SNAP.
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
1. If it's a link on `developers.doku.com` → fetch `<link>.md` and extract additional spec fields.
2. Merge prerequisite info into the spec — especially `TOKEN_ENDPOINT`, additional headers, RSA key requirements.
3. Tag each merged field with its source URL for traceability (append `[source: <url>]` to the field value).

**Example:** Virtual Account BRI page references SNAP B2B token auth on a separate page. Fetch that page, extract `TOKEN_ENDPOINT` and RSA signature algorithm, and merge into the saved spec so `setup-project` can generate complete auth code.

If a prerequisite page is unreachable → include the reference URL in `AUTH_NOTES` so the user can check manually.

---

## Step 4: Archive Previous Spec and Save New One

**Read existing config first:**
```bash
cat .claude/doku-codegen.local.md 2>/dev/null || echo "FILE_NOT_FOUND"
```

Specs are stored per API in an `API_SPECS` map keyed by `API_SLUG`. This lets a project generate clients for multiple DOKU APIs (Checkout + VA + QRIS) without one overwriting another.

**If `API_SPECS[<slug>]` already exists → archive it as `API_SPECS_PREVIOUS[<slug>]` before writing the new one** (used by the `upgrade` skill to diff same-slug changes).

Preserve all existing fields (LANGUAGE, FRAMEWORK, CLIENT_ID, SECRET_KEY, other slug entries) and add/replace only the `API_SPECS[<slug>]` block:

```
API_SPECS:
  <slug>:
    API_NAME: <value>
    ENDPOINTS:
      - method: <e.g. POST>
        path: <e.g. /checkout/v1/payment>
        name: <e.g. create-payment>
      - method: <e.g. GET>
        path: <e.g. /checkout/v1/payment/{id}>
        name: <e.g. inquiry>
    API_ENDPOINT: <ENDPOINTS[0].method + " " + ENDPOINTS[0].path>   # alias, back-compat
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
    SIGNATURE_TYPE: <SNAP | NON_SNAP>
    TOKEN_ENDPOINT: <e.g. /authorization/v1/access-token/b2b, empty if NON_SNAP>
    AUTH_NOTES: <extra auth steps or empty>
    EXAMPLES:
      request: <example JSON or empty>
      response: <example JSON or empty>
    SPEC_SOURCE_URL: <URL(s) fetched, comma-separated>
    SPEC_FETCHED_AT: <ISO 8601 timestamp>
```

If there was a previous version of this slug's spec, also write:
```
API_SPECS_PREVIOUS:
  <slug>:
    <copy of old block>
```

**Back-compat pointer:** also update the top-level `API_SPEC` field to point at the just-written slug (i.e. copy `API_SPECS[<slug>]` contents to `API_SPEC`). Consumers that still read `API_SPEC` continue to work; new consumers read `API_SPECS[<slug>]` explicitly.

---

## Step 5: Confirm

Print:
```
✅ API spec saved: [API_NAME] (slug: [API_SLUG])
   Signature: [SIGNATURE_TYPE] via [SIGNATURE_ALGORITHM]
   Endpoints: [ENDPOINTS.length] ([list method+path])
   Token endpoint: [TOKEN_ENDPOINT or "(none — non-SNAP)"]
   Source: [SPEC_SOURCE_URL]
   Prerequisite pages followed: [N]

Run /doku-codegen:setup-project to generate client code.
```

If any prerequisite pages were unreachable, list them with a warning so the user can check manually.
