---
name: save-session
description: Save current DOKU generation session state so you can resume it later
argument-hint: [optional: note about current state]
---

# /doku-codegen:save-session

Saves the current generation session state to `.claude/doku-session.md` so you can resume exactly where you left off — even across context resets or long breaks.

## What gets saved

```
API being integrated:      Virtual Account BNI
Language / Framework:      Java / Spring Boot 3 + Feign
Generation mode:           add-to-existing
Files written so far:      VaBniClient.java, VaBniController.java, ...
Last step completed:       Step 6a (sdk-generator done)
Next step:                 Step 6b (run integration-validator)
Blockers / open questions: None
```

## How to save

Simply run `/doku-codegen:save-session` at any point:

```
/doku-codegen:save-session
/doku-codegen:save-session stuck on signature interceptor, need to check SNAP spec
```

## Instructions for Claude

When this command is invoked:

1. Read `.claude/doku-codegen.local.md` to get LANGUAGE, FRAMEWORK, API_NAME, API_ENDPOINT, CLIENT_ID presence
2. Read `/tmp/doku-codegen-edited-files.json` if it exists (files written this session)
3. Read `/tmp/doku-codegen-session.json` if it exists (pre-compact state)
4. Ask the user: "What step did you complete last, and what is the next step?"
5. Write `.claude/doku-session.md` with this structure:

```markdown
# DOKU Generation Session
Saved: [ISO timestamp]

## What we're building
API: [API_NAME]
Endpoint: [API_ENDPOINT]
Language: [LANGUAGE] / [FRAMEWORK]
Mode: [add-to-existing | new-project]
Project dir: [cwd]

## Progress
Files written: [N]
[list of filenames]

## Last completed step
[User's answer]

## Next step
[User's answer or inferred]

## Notes / Blockers
[User's optional note from $ARGUMENTS]

## Config state
- Language detected: [yes/no]
- API spec saved: [yes/no]
- Credentials configured: [yes/no]
- Validator result: [PASS/PASS_WITH_WARNINGS/FAIL/not yet run]
```

6. Print:
```
✅ Session saved to .claude/doku-session.md
   Resume with: /doku-codegen:resume-session
```

## Related commands

- `/doku-codegen:resume-session` — restore this session in a new context
- `/doku-codegen:generate` — run generation from scratch
