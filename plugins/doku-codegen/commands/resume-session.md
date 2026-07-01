---
name: resume-session
description: Resume a previously saved DOKU generation session — picks up exactly where you left off
---

# /doku-codegen:resume-session

Reads `.claude/doku-session.md` and gives you a full briefing on the saved session, then asks where to continue.

## When to use

- After a context reset or `/compact` during a long generation task
- Returning to DOKU work after switching to another task
- Handing off a generation session to a colleague

## Instructions for Claude

When this command is invoked:

1. Read `.claude/doku-session.md`:
```bash
cat .claude/doku-session.md 2>/dev/null || echo "NOT_FOUND"
```

2. **If NOT_FOUND:**
```
❌ No saved session found.
   Run /doku-codegen:generate to start a new generation, or /doku-codegen:save-session to save the current one.
```

3. **If found**, print the full briefing:
```
📋 DOKU Session Resume
═══════════════════════════════════════

API:       [API_NAME] — [API_ENDPOINT]
Language:  [LANGUAGE] / [FRAMEWORK]
Mode:      [add-to-existing | new-project]
Saved:     [timestamp]

Progress:
  Files written: [N]
  [list of filenames]

Last completed: [step]
Next step:      [step]

Config state:
  ✅ Language detected
  ✅ API spec saved
  [✅/❌] Credentials configured
  [✅/⚠️/❌] Validator: [result]

Notes: [notes from session]
```

4. Ask:
> "Ready to continue from [Next step]? (yes / show files / start over)"

5. On "yes" → invoke `doku-codegen:setup-project` skill, passing the session context as arguments so it skips already-completed steps.

6. On "show files" → list the files from the session with their full paths.

7. On "start over" → confirm, then delete `.claude/doku-session.md` and run `/doku-codegen:generate`.

## Related commands

- `/doku-codegen:save-session` — save the current session
- `/doku-codegen:generate` — start a fresh generation
