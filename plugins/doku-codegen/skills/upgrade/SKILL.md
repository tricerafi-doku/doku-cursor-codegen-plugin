---
name: upgrade
description: Diff old vs new DOKU API spec and patch only changed generated files. Use when the user says "upgrade DOKU client", "update generated code", or "refresh after spec change". Run /doku-codegen:fetch-api-spec first to capture the new spec, then run this skill to patch affected files without overwriting custom code.
tools: Read, Write, Edit, Bash
origin: doku-codegen
---

# doku-codegen — Upgrade

After re-fetching the DOKU API spec, compare old and new versions to identify what changed, then patch only the affected generated files — without overwriting custom code.

---

## Step 1: Load Config

```bash
cat .claude/doku-codegen.local.md 2>/dev/null || echo "FILE_NOT_FOUND"
```

If config missing → stop:
```
❌ Config not found. Run /doku-codegen:setup-credentials first.
```

**Determine target slug.** If the user specified an API (e.g. "upgrade the checkout client"), use that as the slug. Otherwise ask which API to upgrade, listing the keys present in `API_SPECS` (and falling back to the top-level `API_SPEC` if only the legacy pointer exists).

For the chosen `<slug>`, resolve:
- **New spec** = `API_SPECS[<slug>]` (or top-level `API_SPEC` if only the legacy shape is present)
- **Old spec** = `API_SPECS_PREVIOUS[<slug>]` (or top-level `API_SPEC_PREVIOUS` if only the legacy shape is present)

If the new spec is missing → stop:
```
⚠️  No spec found for slug '<slug>'. Run /doku-codegen:fetch-api-spec first.
```

If the old spec is missing → stop:
```
⚠️  No previous spec found for slug '<slug>' to compare against.

To use this skill:
  1. Run /doku-codegen:fetch-api-spec  ← fetches new spec, archives current as API_SPECS_PREVIOUS[<slug>]
  2. Run /doku-codegen:upgrade         ← diffs and patches changed files
```

**Refuse cross-API diffs.** If the resolved old and new specs have different `API_SLUG` / `API_NAME` values, stop with an error — do not attempt to diff two different APIs against each other.

If both same-slug specs are present → continue.

---

## Step 2: Diff Specs

Compare these fields between the resolved old and new specs (both for the same `<slug>`):

| Field | Change type |
|---|---|
| `ENDPOINTS` | Endpoint added, removed, path or method changed |
| `API_ENDPOINT` | (Legacy) endpoint path or method changed |
| `REQUEST_SCHEMA` | New field, removed field, type change, required flag change |
| `RESPONSE_SCHEMA` | New field, removed field, type change |
| `REQUIRED_HEADERS` | New header, removed header |
| `SIGNATURE_ALGORITHM` | Algorithm changed |
| `SIGNATURE_TYPE` | SNAP / NON_SNAP flip — treat as major change |
| `TOKEN_ENDPOINT` | Path changed |
| `AUTH_NOTES` | Auth flow changed |

Record all differences found.

---

## Step 3: Map Changes to Files

For each diff found, identify the affected generated file(s):

| Change | Affected file (Java example) |
|---|---|
| New request field | `model/request/*.java` |
| Removed request field | `model/request/*.java` |
| New response field | `model/response/*.java` |
| Removed response field | `model/response/*.java` |
| API_ENDPOINT changed | `client/Doku*Client.java` + controller |
| New required header | `config/DokuSignatureInterceptor.java` |
| SIGNATURE_ALGORITHM changed | `config/DokuSignatureInterceptor.java` |
| AUTH_NOTES changed | `config/DokuSignatureInterceptor.java` + README |

Apply same mapping logic for Python and Node.js file structures.

Ask user for the project directory if OUT_DIR is not saved in config:
"Where is the generated project? (e.g. ./doku-checkout-client)"

---

## Step 4: Show Diff Summary and Confirm

Print the diff summary:
```
Spec changes detected:
  + REQUEST_SCHEMA: new field 'payment_method_types' (optional, array of strings)
  - RESPONSE_SCHEMA: removed field 'session_id'
  ~ REQUIRED_HEADERS: 'X-New-Header' added

Files to be updated:
  - src/main/java/.../model/request/OrderRequest.java
  - src/main/java/.../model/response/OrderResponse.java
  - src/main/java/.../config/DokuSignatureInterceptor.java

No changes to: client, controller, build file, application.yml
```

Ask (AskUserQuestion): "Proceed with patching these files?" Yes / No / Show me the changes first

If "Show me the changes first" → describe the specific edits before confirming.

---

## Step 5: Patch Files

Use the `Edit` tool (not Write/full rewrite) to update only the affected sections:

- Add new field → insert property + annotation at the right location
- Remove field → delete property + annotation
- Change type → update the type declaration
- Change header → update the header injection line in the interceptor
- Change algorithm → update the Mac.getInstance / hmac algorithm call

After each edit, print: `✓ Patched: <file path>`

---

## Step 6: Confirm

Print:
```
✅ Updated [N] files.

Changes made:
  - [list of files changed]

Unchanged (custom code preserved):
  - [list of files not touched]

Next steps:
  Restart your app and run /doku-codegen:mock-test to verify.
```

If no changes were detected:
```
✅ No changes detected between old and new spec. Generated files are up to date.
```
