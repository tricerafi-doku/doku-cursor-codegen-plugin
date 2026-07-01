---
name: setup-credentials
description: Collect and store DOKU credentials (CLIENT_ID, SECRET_KEY) in .claude/doku-codegen.local.md. Use when the user says "set up DOKU credentials", "configure client ID", "add secret key", or "rotate DOKU keys". Can be run independently at any time to update or rotate credentials.
tools: Bash, Write, AskUserQuestion
origin: doku-codegen
---

# doku-codegen — Setup Credentials

Collect and save DOKU API credentials. Safe to re-run when rotating keys.

---

## Step 1: Check Existing Credentials

```bash
cat .claude/doku-codegen.local.md 2>/dev/null || echo "FILE_NOT_FOUND"
```

If file exists and has CLIENT_ID and SECRET_KEY, show masked values:
```
Current credentials:
  Client-Id:  BRN-xxxx-****
  Secret Key: SK-****
```

Ask if user wants to update or keep existing.

---

## Step 2: Collect Credentials

Ask each in sequence (plain text prompts — not AskUserQuestion):

1. "Enter your DOKU Client-Id (from DOKU Back Office):"
   → Store as CLIENT_ID

2. "Enter your DOKU Secret Key:"
   → Store as SECRET_KEY

3. Check `API_SPEC.SIGNATURE_ALGORITHM` from config:
   - If it contains "RSA" OR `API_SPEC.AUTH_NOTES` mentions "B2B token" → ask:
     "Enter path to your RSA private key PEM file (required for SNAP APIs):"
     → Store as PRIVATE_KEY_PATH
   - Otherwise → skip this question (not needed for Non-SNAP HMAC-only APIs)

---

## Step 3: Ask Environment (AskUserQuestion)

Ask with 2 options:
1. "Sandbox — https://api-sandbox.doku.com (Recommended for development)"
2. "Production — https://api.doku.com"

Set BASE_URL based on choice:
- Sandbox → `https://api-sandbox.doku.com`
- Production → `https://api.doku.com`

**Note:** BASE_URL from credentials takes precedence over any BASE_URL found in API_SPEC during code generation.

---

## Step 4: Update Config

Read the existing config file:
```bash
cat .claude/doku-codegen.local.md 2>/dev/null || echo "FILE_NOT_FOUND"
```

If file exists, update/add only the credential fields — preserve LANGUAGE, FRAMEWORK, IS_EXISTING_PROJECT, API_SPEC, and all other fields.

If file does not exist, create it:
```bash
mkdir -p .claude
```

Write/update the YAML frontmatter to include:
```
CLIENT_ID: <value>
SECRET_KEY: <value>
PRIVATE_KEY_PATH: <value or leave blank if not applicable>
ENVIRONMENT: <sandbox or production>
BASE_URL: <url>
```

---

## Step 5: Protect Credentials File

Add to .gitignore if not already present:
```bash
grep -q "doku-codegen.local.md" .gitignore 2>/dev/null || echo ".claude/doku-codegen.local.md" >> .gitignore
```

---

## Step 6: Confirm

Print:
```
✅ Credentials saved to .claude/doku-codegen.local.md
✅ Added to .gitignore

Environment: [sandbox/production]
Client-Id:   [first 8 chars]****

To use credentials without committing them, set environment variables:
    export DOKU_CLIENT_ID=[CLIENT_ID]
    export DOKU_SECRET_KEY=[SECRET_KEY]

Run /doku-codegen:setup-project to generate client code.
```
