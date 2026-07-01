---
name: detect-stack
description: Detect the current project's language and framework, then save to .claude/doku-codegen.local.md. Use when the user says "detect stack", "what language is this project", or "doku-codegen detect". Also called automatically by setup-project when no stack config exists.
tools: Bash, Write, AskUserQuestion
origin: doku-codegen
---

# doku-codegen — Detect Stack

Detect or choose the project's language and framework. Saves the result to `.claude/doku-codegen.local.md`.

---

## Step 1: Scan Project Files

Run:
```bash
ls package.json pyproject.toml requirements.txt setup.py go.mod pom.xml build.gradle build.gradle.kts 2>/dev/null
```

Also check for Spring Boot if `pom.xml` is found:
```bash
grep -l "spring-boot" pom.xml 2>/dev/null || true
```

Apply this detection table:

| File present | Language | Framework |
|---|---|---|
| `pom.xml` + spring-boot in content | Java | Spring Boot 3 + Feign Client |
| `pom.xml` (no spring) | Java | Maven |
| `build.gradle` or `build.gradle.kts` | Java/Kotlin | Gradle |
| `package.json` + `tsconfig.json` | TypeScript | Express + axios |
| `package.json` | Node.js | Express + axios |
| `pyproject.toml` or `requirements.txt` | Python | FastAPI + httpx |
| `go.mod` | Go | net/http |

Store result as DETECTED_LANGUAGE and DETECTED_FRAMEWORK (or "none" if nothing found).

---

## Step 2: Confirm or Choose Stack (AskUserQuestion)

**If stack was detected:**
Ask with 2 options:
1. "Use [DETECTED_LANGUAGE] / [DETECTED_FRAMEWORK] (Recommended — matches your project)"
2. "Choose a different language/framework"

If user chooses option 1 → skip to Step 3.
If user chooses option 2 → show the 3 options below.

**If nothing was detected:**
Ask with 3 options:
1. "Java — Spring Boot 3 + Feign Client"
2. "Python — FastAPI + httpx"
3. "Node.js — Express + axios"

Store the chosen language and framework.

---

## Step 3: Save Config

Check if `.claude/doku-codegen.local.md` already exists:
```bash
cat .claude/doku-codegen.local.md 2>/dev/null || echo "FILE_NOT_FOUND"
```

If file exists, preserve existing fields (CLIENT_ID, SECRET_KEY, API_SPEC, etc.) and update only LANGUAGE, FRAMEWORK, IS_EXISTING_PROJECT.

If file does not exist, create it:

```bash
mkdir -p .claude
```

Write (or rewrite) the file with:
```
---
LANGUAGE: <chosen language>
FRAMEWORK: <chosen framework>
IS_EXISTING_PROJECT: <true if any indicator file was found, false otherwise>
---
```

If existing content had more fields (CLIENT_ID, API_SPEC, etc.), preserve them by merging — do not overwrite those sections.

---

## Step 4: Confirm

Print:
```
✅ Stack saved: [LANGUAGE] / [FRAMEWORK]
   IS_EXISTING_PROJECT: [true/false]

Next steps:
  /doku-codegen:fetch-api-spec    ← fetch API spec from developers.doku.com
  /doku-codegen:setup-credentials ← configure CLIENT_ID and SECRET_KEY
  /doku-codegen:setup-project     ← generate client code (runs missing steps automatically)
```
