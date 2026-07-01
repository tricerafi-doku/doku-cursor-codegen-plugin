# DOKU Codegen — User Guide

Install, use, and debug the DOKU Codegen plugin for Cursor. Assumes you're on Cursor desktop IDE (not the Cursor Agent cloud app).

---

## What this plugin does

Turns Cursor's Agent into a DOKU integration engineer. In one prompt:

1. Detects your project's language and framework
2. Fetches the live DOKU API spec from `developers.doku.com` (never guesses from training data)
3. Collects your DOKU merchant credentials
4. Generates a production-ready API client — signature helpers, HTTP client, DTOs, error handling, tests, `.env.example`
5. Runs quality/security hooks around every file write
6. Reports a production readiness checklist before you ship

Supported: Java (Spring Boot), Kotlin (Spring Boot), Python (FastAPI/Flask/Django), Node.js (Express/NestJS), Go (Gin), PHP (Laravel).

---

## 1. Install

### Option A — From the marketplace (recommended)

1. Open Cursor.
2. Left sidebar → **Customize**.
3. Under **Repositories**, click the `+` icon.
4. Paste:
   ```
   https://github.com/tricerafi-doku/doku-cursor-codegen-plugin
   ```
5. In **Customize → Plugins**, search `doku`, click **Add** on **DOKU Codegen**.
6. Fully quit Cursor (`Cmd+Q`) and reopen — plugins load at launch.

### Option B — Local dev install

Only needed if you want to edit the plugin itself.

```bash
git clone https://github.com/tricerafi-doku/doku-cursor-codegen-plugin.git
cd doku-cursor-codegen-plugin
mkdir -p ~/.cursor/plugins/local
cp -R plugins/doku-codegen ~/.cursor/plugins/local/doku-codegen
```

**Do not `ln -s`** — Cursor rejects symlinks pointing outside `~/.cursor/plugins/local/`. Use `cp -R` and re-copy after every edit.

### Verify the install

- **Customize → Plugins** should list "DOKU Codegen"
- Click it — you should see: **2 Subagents**, **7 Commands**, **8 Skills**, **1 Hooks group**
- In Agent chat, type `/gen` — autocomplete should suggest `/generate`

---

## 2. First-run setup

### Credentials

Two ways to provide them; pick one:

**A) Let the plugin ask you** (recommended for demos):

Type in Agent chat:
```
Generate a DOKU Virtual Account client
```

The `setup-credentials` skill runs and prompts you for Client ID + Secret Key. Values are saved to `<project>/.claude/doku-codegen.local.md`.

**B) Pre-create the config file** (recommended for scripted setups):

```bash
mkdir -p .claude
cat > .claude/doku-codegen.local.md <<'EOF'
---
CLIENT_ID: BRN-XXXX-XXXXXXXXXXXXX
SECRET_KEY: your_secret_key_here
ENVIRONMENT: sandbox
---
EOF
```

Where to get credentials: **DOKU Dashboard → Integration → API Keys**. UAT and Production have separate keys.

### Project folder

Open a **specific folder** in Cursor (File → Open Folder). The plugin operates on `${workspaceFolder}` — one project at a time. Everything the plugin reads and writes is relative to this folder.

---

## 3. How to use

### The one-command flow

```
Generate a DOKU checkout client in this project
```

That's it. The plugin handles:
- `detect-stack` → find language/framework
- `fetch-api-spec` → scrape developers.doku.com
- `setup-credentials` → prompt if missing
- `sdk-generator` agent → write all the code
- `integration-validator` agent → audit the result

### Slash commands (explicit invocation)

Type in Agent chat:

| Command | Purpose |
|---|---|
| `/generate [payment-method]` | Full setup + generate. Main entry. |
| `/spec [payment-method]` | Refetch a specific API spec |
| `/checklist` | Production readiness checks |
| `/test` | Send a real request to DOKU sandbox to verify signature + connectivity |
| `/postman` | Export a Postman collection with signature pre-request script |
| `/save-session [note]` | Snapshot current generation state so you can resume later |
| `/resume-session` | Resume a saved session |

### Skills (auto-triggered by natural language)

You don't need to type slash commands. Say things like:

| Say | Runs |
|---|---|
| "detect the stack" / "what language is this" | `detect-stack` |
| "fetch the DOKU spec" / "load API docs" | `fetch-api-spec` |
| "set up credentials" / "rotate API key" | `setup-credentials` |
| "test DOKU integration" / "verify sandbox" | `mock-test` |
| "production checklist" / "ready to ship" | `production-checklist` |
| "upgrade DOKU client" / "refresh after spec change" | `upgrade` |
| "generate Postman collection" | `generate-postman` |

### Agents (specialized system prompts)

| Agent | When it kicks in |
|---|---|
| `sdk-generator` | Any Write of DOKU client code — always runs under this system prompt |
| `integration-validator` | After generation, audits the whole file set for security gaps |

### What the plugin persists

- `.claude/doku-codegen.local.md` — credentials, detected stack, saved API spec (**this file is gitignored automatically**)
- Generated source code — under whatever paths match your project's conventions (`src/`, `app/`, etc.)
- Config templates — `.env.example`, `.gitignore` additions

---

## 4. Debugging

### Symptom: "DOKU Codegen doesn't show up in Customize"

1. Confirm plugin files are in place:
   ```bash
   ls ~/.cursor/plugins/local/doku-codegen
   ```
   Should show `agents/ commands/ skills/ hooks/ scripts/ standards/`. If empty or missing, redo the `cp -R` (Option B) or re-add the repo (Option A).
2. Confirm you did a **full quit** (`Cmd+Q`), not just window close.
3. Cursor logs: **View → Output → dropdown → "Cursor MCP" / "Extensions"** — grep for `loadUserLocalPlugin doku-codegen`. If you see `rejected: symlink target ... is outside`, you used `ln -s` — switch to `cp -R`.

### Symptom: `/generate` doesn't autocomplete

- Slash-command autocomplete lives in Agent chat, not the Command Palette. Type `/` at the start of a chat message.
- If plugin is loaded but slash commands are missing, check `plugins/doku-codegen/commands/*.md` all have `name:` and `description:` in frontmatter.
- Restart Cursor after any manual edit to plugin files.

### Symptom: Hook doesn't fire on file write

- Hooks fire on `postToolUse` for Write/Edit — the Agent must actually invoke the Write tool, not just show code in chat.
- Node must be on PATH. Test: `which node` in Cursor's integrated terminal.
- Look at Cursor's Output panel → hook stderr appears here.
- Check `scripts/lib/hook-flags.js` — hooks respect `DOKU_HOOK_PROFILE` env var. If you set `DOKU_HOOK_PROFILE=off` in your shell, no hooks fire.

### Symptom: Spec fetch fails

- `fetch-api-spec` uses Cursor's WebFetch tool against `developers.doku.com`. That URL must be reachable from your network.
- If you're behind a corporate proxy, WebFetch may fail — the plugin will fall back to asking you for the spec manually.
- Cached spec lives in `.claude/doku-codegen.local.md` under `API_SPEC`. Delete that block to force a refetch.

### Symptom: Generated code raises `ValueError: DOKU_CLIENT_ID must not be empty` on first run

The generated Python entry point may not have called `load_dotenv()`. Two-line fix:

```python
# app/main.py (top of file)
from dotenv import load_dotenv
load_dotenv()
```

And add `python-dotenv>=1.0.0` to `requirements.txt`.

Newer versions of the plugin catch this at generation time via `post-write-python-check.js` — you'll see a WARN in Cursor's Output panel: `Reads DOKU_* env var without load_dotenv() or pydantic_settings.BaseSettings — see standards/python.md`.

### Symptom: `/test` returns 401 / 403 from DOKU

- Your credentials in `.claude/doku-codegen.local.md` are wrong or expired. Re-run:
  ```
  /environment-check
  ```
  or manually edit the file.
- UAT keys don't work against production URL and vice versa. Check `ENVIRONMENT: sandbox|production` matches your key.
- Signature debugging: run `/test --verbose` (if supported) to see the string-to-sign the plugin computed vs the one DOKU expected. First few bytes usually reveal which header is misordered.

### Symptom: Post-write hook flagged a warning

The finding is in Cursor's Output panel:
```
[doku-codegen] Quality check: config.py
  [WARN] Reads DOKU_* env var without load_dotenv() ...
```

Open `plugins/doku-codegen/standards/python.md` (or `.md` for your language) — the standards doc explains the required pattern. Fix the code, save — hook re-runs.

To temporarily silence (not recommended):
```bash
export DOKU_DISABLED_HOOKS="post-write-python-check"
```

### Symptom: "MCP server missing"

Not applicable — this plugin has no MCP server. If you see this error, you're looking at `doku-payment` logs, not `doku-codegen`.

### Where the logs are

- **Cursor Output panel** → dropdown → "Cursor MCP", "Extensions", or plugin-name-specific channels
- **Hook stderr** → also appears in Output panel and in the Agent chat's tool-call detail view (click the arrow next to the tool call)
- **Cursor developer console** → `Help → Toggle Developer Tools → Console` (for deeper platform-level errors)

---

## 5. Uninstall

**From marketplace install:** Customize → Plugins → click **DOKU Codegen** → **Uninstall**.

**From local install:**
```bash
rm -rf ~/.cursor/plugins/local/doku-codegen
```
Restart Cursor.

---

## 6. Where to file bugs / ask questions

- **Codegen bugs** (wrong signature, missing dependency, hook false positive): file against `tricerafi-doku/doku-cursor-codegen-plugin` on GitHub, including the generated file and the standards section it violates.
- **DOKU API bugs / spec drift**: report to `technology@doku.com` — the plugin follows whatever the live spec says.
- **Plugin scaffolding / Cursor install issues**: check `~/.cursor/plugins/local/doku-codegen` layout matches this repo's `plugins/doku-codegen/` — if not, re-copy.
