# DOKU Codegen — User Guide

Install, use, and troubleshoot the DOKU Codegen plugin for Cursor.

> Cursor ships two apps: the **desktop IDE** (VS Code fork with a code editor and file tree) and the **Cursor Agent** cloud app. This plugin runs in the **desktop IDE**.

---

## What this plugin does

In one prompt, the plugin's Agent:

1. Detects your project's language and framework.
2. Fetches the live DOKU API spec from `developers.doku.com`.
3. Collects your DOKU merchant credentials.
4. Generates a production-ready API client — signature helpers, HTTP client, DTOs, error handling, tests, `.env.example`.
5. Runs quality and security checks around every file it writes.
6. Reports a production-readiness checklist.

Supported stacks: **Java** (Spring Boot), **Kotlin** (Spring Boot), **Python** (FastAPI/Flask/Django), **Node.js** (Express/NestJS), **Go** (Gin), **PHP** (Laravel).

---

## 1. Install

### From the marketplace (recommended)

1. Open the Cursor desktop IDE.
2. Left sidebar → **Customize**.
3. Under **Repositories**, click the `+` icon.
4. Paste:
   ```
   https://github.com/tricerafi-doku/doku-cursor-codegen-plugin
   ```
5. Under **Customize → Plugins**, search `doku` and click **Add** on **DOKU Codegen**.
6. Fully quit Cursor (`Cmd+Q`) and reopen. Plugins load at launch.

### Local install (for editing the plugin itself)

```bash
git clone https://github.com/tricerafi-doku/doku-cursor-codegen-plugin.git
cd doku-cursor-codegen-plugin
mkdir -p ~/.cursor/plugins/local
cp -R plugins/doku-codegen ~/.cursor/plugins/local/doku-codegen
```

Cursor rejects symbolic links whose target lives outside `~/.cursor/plugins/local/`. Use `cp -R` and re-copy after edits.

### Verify the install

After the restart:

- **Customize → Plugins** lists **DOKU Codegen**.
- Clicking it shows **2 Subagents**, **7 Commands**, **8 Skills**, **1 Hooks group**.
- In Agent chat, typing `/gen` autocompletes to `/generate`.

---

## 2. First-run setup

### Provide credentials

Get your `CLIENT_ID` and `SECRET_KEY` from the **DOKU Dashboard → Integration → API Keys**. UAT (sandbox) and Production have separate keys.

Two ways to provide them; pick one.

**Let the plugin prompt you.** In Agent chat:

```
Generate a DOKU Virtual Account client
```

The plugin asks for the values and saves them to `<project>/.claude/doku-codegen.local.md`.

**Pre-create the config file.**

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

`.claude/doku-codegen.local.md` is automatically added to `.gitignore` — credentials never leave your machine.

### Open your project folder

**File → Open Folder** in Cursor. The plugin reads and writes files relative to the folder you have open. One project at a time.

---

## 3. How to use

### The one-command flow

In Agent chat:

```
Generate a DOKU checkout client in this project
```

The plugin then, in order:

- Detects the stack
- Fetches the relevant DOKU API spec
- Prompts for credentials if not yet configured
- Generates the client under your project's conventions
- Audits the generated files

### Slash commands

| Command | Purpose |
|---|---|
| `/generate [payment-method]` | Main entry point — full setup + generate |
| `/spec [payment-method]` | Fetch and save a specific API spec |
| `/checklist` | Run production-readiness checks |
| `/test` | Send a real request to DOKU sandbox to verify signature and connectivity |
| `/postman` | Export a Postman collection with a signature pre-request script |
| `/webhook` | Scaffold an inbound notification / webhook receiver |
| `/save-session [note]` | Snapshot the current generation state |
| `/resume-session` | Continue from a saved snapshot |

### Auto-triggered skills

You can also speak naturally — the plugin routes to the right skill:

| You say | Plugin runs |
|---|---|
| "detect the stack", "what language is this" | `detect-stack` |
| "fetch the DOKU spec", "load API docs" | `fetch-api-spec` |
| "set up credentials", "rotate API key" | `setup-credentials` |
| "test DOKU integration", "verify sandbox" | `mock-test` |
| "production checklist", "ready to ship" | `production-checklist` |
| "upgrade DOKU client", "refresh after spec change" | `upgrade` |
| "generate Postman collection" | `generate-postman` |
| "add DOKU webhook", "handle DOKU callbacks", "verify notification signature" | `webhook-receiver` |

### Agents

- **`sdk-generator`** — carries the system prompt used whenever the plugin writes DOKU client code. Language-specific standards live in `standards/`.
- **`integration-validator`** — audits the generated file set for security gaps after generation.

### What the plugin persists

| File | Purpose |
|---|---|
| `.claude/doku-codegen.local.md` | Credentials, detected stack, saved API spec (gitignored) |
| Generated source | Under your project's conventional paths (`src/`, `app/`, etc.) |
| `.env.example` | Placeholder env-var template committed alongside code |

---

## 4. Troubleshooting

### DOKU Codegen doesn't appear in Customize

1. Confirm files are in place after a local install:
   ```bash
   ls ~/.cursor/plugins/local/doku-codegen
   ```
   You should see `agents/ commands/ skills/ hooks/ scripts/ standards/`.
2. Fully quit Cursor (`Cmd+Q`) — window close is not enough.
3. Open **View → Output** and search for `loadUserLocalPlugin doku-codegen`. If you see `rejected: symlink target ... is outside`, replace the symlink with `cp -R`.

### `/generate` doesn't autocomplete

- Slash-command autocomplete lives in Agent chat, not the Command Palette. Type `/` at the start of a chat message.
- Restart Cursor after any manual edit to plugin files.

### The post-write hook doesn't fire

- Hooks fire when the Agent invokes the Write or Edit tool. If the plugin only *shows* code in chat without writing files, no hook runs.
- Node must be on your `PATH`. Confirm with `which node` in the integrated terminal.
- Hook stderr appears in Cursor's **View → Output** panel.

### Spec fetch fails

- The plugin uses Cursor's WebFetch against `developers.doku.com`. That domain must be reachable.
- Behind a corporate proxy, WebFetch may fail; the plugin falls back to asking you for the spec manually.
- To force a refetch, delete the `API_SPEC` block from `.claude/doku-codegen.local.md`.

### Generated Python code raises `ValueError: DOKU_CLIENT_ID must not be empty`

Python does not read `.env` files automatically. Fix by adding the two lines at the top of `app/main.py` (before any other imports that read env):

```python
from dotenv import load_dotenv
load_dotenv()
```

Add `python-dotenv>=1.0.0` to `requirements.txt`, then `pip install python-dotenv`. Alternatively, model `DokuConfig` as a `pydantic_settings.BaseSettings` subclass, which reads `.env` automatically.

The `post-write-python-check` hook will emit a WARN when the generated code contains `os.environ.get("DOKU_...")` without either loader in place. Check `standards/python.md` for the required pattern.

### `/test` returns 401 or 403

- The credentials in `.claude/doku-codegen.local.md` are wrong or expired. Re-run `/setup-credentials` or edit the file.
- UAT keys don't work against the production URL and vice versa. Confirm `ENVIRONMENT: sandbox|production` matches the key.
- If the signature is wrong, compare the string-to-sign in your logs against DOKU's documented format for the specific API — the plugin logs the components before HMAC when run in verbose mode.

### A post-write hook flagged a warning

The finding is in **View → Output**:

```
[doku-codegen] Quality check: config.py
  [WARN] Reads DOKU_* env var without load_dotenv() or pydantic_settings.BaseSettings — see standards/python.md
```

Open the standards document referenced in the warning (`standards/python.md`, `standards/java.md`, etc.) for the required pattern.

### Silencing hooks

Three environment variables control hook execution, from most targeted to most global:

| Env var | Scope | When to use |
|---|---|---|
| `DOKU_DISABLED_HOOKS="<hook-id>[,<hook-id>...]"` | Per-hook | Silence one or a few noisy hooks; leave the rest running. Hook IDs match the first arg passed to `run-with-flags.js` (e.g. `post-write-python-check`, `pre-write-doku-config`, `session-start`). |
| `DOKU_HOOK_PROFILE="minimal"` | Profile-based | Disable the "standard" and "strict" profile hooks; keep only critical ones. Profiles are declared per-hook in `hooks.json`. |
| `DOKU_HOOKS_DISABLED=1` | Global kill | Turns off every doku-codegen hook. Useful when troubleshooting whether a hook is causing an Agent problem, or when running a scripted operation that must not be interrupted. |

Example — silence a single noisy hook:

```bash
export DOKU_DISABLED_HOOKS="post-write-python-check"
```

Example — turn everything off temporarily:

```bash
export DOKU_HOOKS_DISABLED=1
# ...do your thing...
unset DOKU_HOOKS_DISABLED
```

None of these are recommended for production code — they're for local debugging.

### Where the logs are

- **Cursor Output panel:** `View → Output` → dropdown → language server, plugin, or extension channels
- **Hook stderr:** appears in the Output panel and in each tool call's detail view (click the arrow next to the tool name in the chat)
- **Cursor developer console:** `Help → Toggle Developer Tools → Console`

---

## 5. Uninstall

**Marketplace install:** Customize → Plugins → open **DOKU Codegen** → **Uninstall**.

**Local install:**

```bash
rm -rf ~/.cursor/plugins/local/doku-codegen
```

Restart Cursor.

---

## 6. Getting help

- **Plugin bugs** (wrong signature, missing dependency, hook false positive): open an issue at https://github.com/tricerafi-doku/doku-cursor-codegen-plugin/issues with the generated file and the standards section it violates.
- **DOKU API questions**: email `technology@doku.com`. The plugin follows whatever the live spec on `developers.doku.com` says.
- **Cursor install questions**: consult Cursor's own docs at https://cursor.com/docs/plugins.
