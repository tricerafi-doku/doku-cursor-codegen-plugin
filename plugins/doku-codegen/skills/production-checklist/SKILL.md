---
name: production-checklist
description: Verify the generated DOKU project is production-ready. Use when the user says "production checklist", "ready for production", "go live checklist", or "pre-production check". Runs 8 automated checks and prints remediation steps for any failures.
tools: Bash, Read
origin: doku-codegen
---

# doku-codegen — Production Checklist

Verify that the generated project is production-ready before going live. Runs all checks automatically and prints ✅ / ⚠️ / ❌ for each.

---

## Step 1: Load Config

```bash
cat .claude/doku-codegen.local.md 2>/dev/null || echo "FILE_NOT_FOUND"
```

If missing → print error and stop:
```
❌ Config not found. Run /doku-codegen:setup-credentials first.
```

Extract: CLIENT_ID, ENVIRONMENT, LANGUAGE, OUT_DIR (or ask user for project path if not in config).

---

## Step 2: Run All Checks

Run each check and record pass/warn/fail:

### Check 1: Credentials in env vars
```bash
grep -r "CLIENT_ID\|SECRET_KEY\|client-id\|secret-key" [OUT_DIR]/src 2>/dev/null | grep -v "\${" | grep -v ".env.example" | grep -v "# " | head -20
```
- ✅ Pass: no hardcoded credential values found
- ❌ Fail: hardcoded value found → "Move credentials to environment variables: export DOKU_CLIENT_ID=..."

### Check 2: BASE_URL is production
Read ENVIRONMENT from config:
- ✅ Pass: ENVIRONMENT is "production" or BASE_URL is `https://api.doku.com`
- ⚠️ Warning: ENVIRONMENT is "sandbox" → "Update /doku-codegen:setup-credentials to set environment to production"

### Check 3: Log level not DEBUG
```bash
grep -r "DEBUG\|Level.FULL" [OUT_DIR]/src/main/resources [OUT_DIR]/src/main 2>/dev/null | grep -i "log\|level" | head -10
```
- ✅ Pass: no DEBUG log level set for signature/config loggers
- ⚠️ Warning: DEBUG level found → "Set log level to INFO/WARN in production config. In DokuFeignConfig, change Logger.Level.FULL to Logger.Level.BASIC."

### Check 4: Secrets not logged
```bash
grep -r "secretKey\|secret_key\|SECRET_KEY\|Signature.*log\|log.*Signature" [OUT_DIR]/src/main 2>/dev/null | grep -v "//" | head -10
```
- ✅ Pass: no secret values in log statements
- ❌ Fail: secret in log statement → "Remove log statements that output secretKey or Signature values"

### Check 5: .gitignore includes credentials file
```bash
grep -q "doku-codegen.local.md" .gitignore 2>/dev/null && echo "FOUND" || echo "MISSING"
```
- ✅ Pass: `.claude/doku-codegen.local.md` is in .gitignore
- ❌ Fail → "Add `.claude/doku-codegen.local.md` to .gitignore immediately"

### Check 6: Tests pass
Run test command based on LANGUAGE:
- Java: `cd [OUT_DIR] && mvn test -q 2>&1 | tail -5`
- Python: `cd [OUT_DIR] && pytest -q 2>&1 | tail -5`
- Node.js: `cd [OUT_DIR] && npm test 2>&1 | tail -5`
- ✅ Pass: all tests pass
- ❌ Fail: show test output and "Fix failing tests before deploying to production"

### Check 7: Error handling present
```bash
grep -r "4xx\|5xx\|FeignException\|HTTPError\|catch\|except\|error_messages" [OUT_DIR]/src/main 2>/dev/null | head -5
```
- ✅ Pass: error handling code found
- ⚠️ Warning: no error handling found → "Add try/catch blocks for 4xx and 5xx responses in your controller/route handler"

### Check 8: Input validation present
```bash
grep -r "@Valid\|@NotNull\|@NotBlank\|@Min\|validate\|ValidationError\|required" [OUT_DIR]/src/main 2>/dev/null | head -5
```
- ✅ Pass: validation annotations/calls found
- ⚠️ Warning: no validation found → "Add input validation on required fields (amount, invoice_number) before calling the DOKU API"

---

## Step 3: Print Summary

```
Production Readiness Report
═══════════════════════════

✅ Credentials in env vars
⚠️  BASE_URL is production         → Run /doku-codegen:setup-credentials to switch to production
✅ Log level not DEBUG
✅ Secrets not logged
✅ .gitignore includes credentials file
✅ Tests pass
✅ Error handling present
✅ Input validation present

Result: [N/8 checks passed]

[List any ❌ or ⚠️ items with remediation steps]
```

If all 8 pass:
```
🚀 All checks passed. Your integration is production-ready.
```
