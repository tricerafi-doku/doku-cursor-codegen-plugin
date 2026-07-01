---
name: checklist
description: Run production readiness checks on the DOKU integration. Verifies env vars, no hardcoded secrets, logging config, error handling.
---

# /doku-codegen:checklist

Invokes the **doku-codegen:production-checklist** skill.

Runs 8 automated checks and prints remediation steps for any failures before you go live.

## Usage

```
/doku-codegen:checklist
```

## Checks performed

| Check | Pass condition |
|-------|---------------|
| Credentials in env vars | No hardcoded CLIENT_ID/SECRET_KEY in source |
| BASE_URL is production | `https://api.doku.com` (not sandbox) |
| Log level not DEBUG | No DEBUG on signature/config loggers |
| Secrets not logged | No log statements containing secretKey |
| .gitignore covers credentials | `doku-codegen.local.md` in .gitignore |
| Tests pass | All tests green |
| Error handling present | 4xx/5xx handlers in controller |
| Input validation present | Required fields validated before API call |
