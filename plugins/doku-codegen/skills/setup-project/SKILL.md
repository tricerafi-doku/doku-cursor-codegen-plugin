---
name: setup-project
description: Generate a complete DOKU payment API client for any payment method — current or future. This is the main entry point; it fetches the live spec from developers.doku.com and auto-runs detect-stack and setup-credentials inline if config is missing. Use for any request to generate, create, add, build, or integrate payment code — regardless of which payment method or API is named.
tools: Bash, WebFetch, AskUserQuestion, Read, Write
origin: doku-codegen
---

# doku-codegen — Setup Project (Orchestrator)

This skill is a **pure orchestrator**. It gathers all prerequisites, confirms with the user, then dispatches to the `sdk-generator` agent which does all the actual code writing.

---

## HARD RULES — Read Before Starting

**NEVER skip the spec fetch.** Even if the user names a specific DOKU API ("checkout", "VA BNI", etc.) in their message, you DO NOT know the current API spec — your training data may be outdated. You MUST always fetch the live spec from `developers.doku.com` via `sitemap-pages.xml`. There are no exceptions.

**NEVER generate a file list from training knowledge.** The file list in Step 4 must be derived entirely from the `API_SPEC` saved in config after the fetch. If `API_SPEC` is not in config, do not proceed to Step 2.

**NEVER assume credentials.** If `CLIENT_ID` is not in config, collect it from the user before generating any files.

**STOP if any prerequisite fails.** If the user declines to provide a required field (API selection, credentials), stop and explain what is needed. Do not proceed with partial information.

---

## Step 1: Load Config (with Inline Fallbacks)

```bash
cat .claude/doku-codegen.local.md 2>/dev/null || echo "FILE_NOT_FOUND"
```

Handle each missing field inline:

### If LANGUAGE is missing:
Print: `🔍 No stack detected — running detect-stack...`

```bash
ls package.json pyproject.toml requirements.txt setup.py go.mod pom.xml build.gradle build.gradle.kts 2>/dev/null
grep -l "spring-boot" pom.xml 2>/dev/null || true
```

Detection table: pom.xml+spring → Java/Spring Boot | package.json → Node.js/Express | pyproject.toml → Python/FastAPI | go.mod → Go. If detected, confirm with user. If not detected, ask user to choose.

Save LANGUAGE, FRAMEWORK, IS_EXISTING_PROJECT to config.

### If API_SPEC is missing:
Print: `📄 No API spec found — fetching live spec from developers.doku.com...`

**This step is mandatory. Do not skip it, do not use training knowledge as a substitute.**

If the user's message already names the API (e.g. "checkout", "VA BNI", "QRIS"), use that as the keyword — you do not need to ask again. Otherwise ask which DOKU API (Checkout, Virtual Account, QRIS, Convenience Store, or Other).

Fetch `https://developers.doku.com/sitemap-pages.xml` — this is the ONLY reliable way to find the correct page URL because the root is JS-rendered. Match URLs by keyword. Follow the matching URL to the endpoint detail page. Follow prerequisite cross-references (auth pages, SNAP token pages). Extract the full spec.

**Immediately write the spec to config before doing anything else.** Do not hold it in memory. Use the Write tool to save `.claude/doku-codegen.local.md` with the API_SPEC block now — before asking for credentials, before asking about mode, before generating any file list. This ensures the spec survives any interruption.

```
---
LANGUAGE: (leave blank if not yet detected)
API_SPEC:
  API_NAME: <value>
  API_ENDPOINT: <value>
  BASE_URL:
    sandbox: <value>
    production: <value>
  REQUIRED_HEADERS: <value>
  REQUEST_SCHEMA: <value>
  RESPONSE_SCHEMA: <value>
  SIGNATURE_ALGORITHM: <value>
  AUTH_NOTES: <value>
SPEC_SOURCE_URL: <url fetched>
SPEC_FETCHED_AT: <ISO timestamp>
---
```

Print: `✅ Spec saved to .claude/doku-codegen.local.md`

**Do not proceed to Step 2 until API_SPEC is written to disk and confirmed.** If the fetch or write fails, tell the user and stop.

### If CLIENT_ID is missing:
Print: `🔑 No credentials found — let's set them up...`

Ask:
1. "Enter your DOKU Client-Id (from DOKU Back Office):"
2. "Enter your DOKU Secret Key:"
3. Only if API_SPEC.SIGNATURE_TYPE = SNAP or AUTH_NOTES mentions "B2B token": "Enter path to your RSA private key PEM file:"

Ask environment: Sandbox (Recommended) or Production. Save BASE_URL accordingly.

Save to config. Append `.claude/doku-codegen.local.md` to `.gitignore` if not present.

---

## Step 2: Choose Mode (AskUserQuestion)

> "How would you like to generate the DOKU client?"
>
> 1. **Add to existing project** *(Recommended if IS_EXISTING_PROJECT is true)* — adds client + models + controller into current project's package structure; skips existing shared files
> 2. **Full new project** — creates a standalone project in a new directory with build file, main app, full config, all files

Store as MODE.

---

## Step 3a: If MODE = add-to-existing — Discover Project Layout

```bash
ls -1
find . -type f \( -name "*.java" -o -name "*.py" -o -name "*.ts" -o -name "*.js" -o -name "*.go" -o -name "*.php" \) \
  ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/target/*" ! -path "*/__pycache__/*" \
  | head -30
```

Answer these by example from the file list:
- Clients dir: find `*Client*`, `*client*`, `*Service*` that make HTTP calls
- Controllers dir: find `*Controller*`, `*router*`, `*routes*`, `*handler*`
- Models dir: find files in `model/`, `models/`, `dto/`, `schema/`
- Base namespace/package: read `package`/`import`/`module` from any existing source file
- Config file: look for `application.yml`, `.env`, `config.py`, `config.js`

Find existing DOKU infrastructure:
```bash
find . -type f ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/target/*" \
  | xargs grep -l -i "doku\|hmacsha256\|hmacsha512\|request-signature" 2>/dev/null | head -10
```

Build PROJECT_LAYOUT and EXISTING_FILES.

Confirm detected layout with user before proceeding.

---

## Step 3b: If MODE = new-project — Ask Output Directory

Ask: "Where should I create the project?" → default `./doku-[api-slug]-client`

Store as OUT_DIR. Derive BASE_PACKAGE from config or ask (default `com.merchantx.payment`).

---

## Step 4: Show File List and Confirm

Show the exact list of files the agent will create or skip:

```
Files to create:
  ✦ src/main/java/.../client/BniVirtualAccountClient.java
  ✦ src/main/java/.../controller/BniVirtualAccountController.java
  ✦ src/main/java/.../model/request/bni/BniCreateVaRequest.java
  ...

Already present (will not overwrite):
  ~ config/DokuSignatureInterceptor.java
  ~ config/DokuFeignConfig.java
  ~ config/DokuLoggingInterceptor.java
```

Ask: "Ready to generate? (yes/no)"

On no → ask what to change and adjust.

---

## Step 5: Create Directories

```bash
mkdir -p {paths as needed for mode}
```

---

## Step 6: Dispatch to sdk-generator Agent

Pass the following context to the `sdk-generator` agent:

```
LANGUAGE:       [from config]
FRAMEWORK:      [from config]
MODE:           [add-to-existing | new-project]
API_SPEC:       [full API_SPEC block from config]
PROJECT_LAYOUT: [SRC_ROOT, clients dir, controllers dir, models dir, namespace, config file]
EXISTING_FILES: [list of files to skip]
OUT_DIR:        [new-project only]
BASE_PACKAGE:   [new-project only]
PLUGIN_ROOT:    ${CLAUDE_PLUGIN_ROOT}
```

The agent handles all file writing. Do not write any code files yourself.

Wait for the agent to complete. Collect the list of files it created.

---

## Step 6b: Dispatch to integration-validator Agent

After `sdk-generator` completes, pass the following to the `integration-validator` agent:

```
GENERATED_FILES: [list of files created by sdk-generator]
LANGUAGE:        [from config]
API_SPEC:        [full API_SPEC block from config]
MODE:            [add-to-existing | new-project]
PLUGIN_ROOT:     ${CLAUDE_PLUGIN_ROOT}
```

Wait for the agent to return `VALIDATION_RESULT`, `BLOCKING_ISSUES`, `AUTO_FIXED`, and `REMAINING_WARNINGS`.

---

## Step 7: Post-Generation Message

Use `VALIDATION_RESULT` from the integration-validator to shape the message.

### If VALIDATION_RESULT = FAIL

```
⚠️  [API_NAME] client generated but has blocking issues that must be fixed:

[list each BLOCKING_ISSUE with file path and fix guidance]

Files created: [N] | Auto-fixed by validator: [AUTO_FIXED]

Fix the issues above, then:
🔬 /doku-codegen:mock-test
```

### If VALIDATION_RESULT = PASS or PASS_WITH_WARNINGS

**For `add-to-existing`:**
```
✅ Added [API_NAME] client to existing project
   Files created: [N] | Skipped (already exist): [M]
   Validator: [✅ All checks passed | ⚠️ N warnings auto-fixed]

[If REMAINING_WARNINGS, list them here as ⚠️ items]

▶  Restart your app to pick up the new endpoints:
    mvn spring-boot:run   (or ./gradlew bootRun)

🔬 Test the integration:
    /doku-codegen:mock-test

🔗 DOKU API docs: https://developers.doku.com
```

**For `new-project`:**
```
✅ Project generated at: [OUT_DIR]
   Files created: [N] files
   API: [API_NAME] — [API_ENDPOINT]
   Validator: [✅ All checks passed | ⚠️ N warnings auto-fixed]

[If REMAINING_WARNINGS, list them here as ⚠️ items]

⚠️  Security: Move credentials to environment variables before production:
    export DOKU_CLIENT_ID=[CLIENT_ID]
    export DOKU_SECRET_KEY=[SECRET_KEY]

▶  Run the project:
    [language-specific run command]

🔬 Test the integration:
    /doku-codegen:mock-test

📋 Production readiness:
    /doku-codegen:production-checklist

🔗 DOKU Sandbox dashboard: https://dashboard-sandbox.doku.com
🔗 DOKU API docs:          https://developers.doku.com
```
