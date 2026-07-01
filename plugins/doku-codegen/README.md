# DOKU Codegen Plugin for Cursor

Generate DOKU API client code in any language — Cursor's Agent detects your tech stack, fetches live API specs from developers.doku.com, and writes production-quality client code.

## Quick Setup

**Step 1 — Install from the marketplace**

In Cursor:

1. Open **Customize** in the left sidebar.
2. Under **Repositories**, click the `+` icon.
3. Paste the marketplace repo URL:
   ```
   https://github.com/tricerafi-doku/doku-cursor-codegen-plugin
   ```
4. Search `doku` in Customize → Plugins and click **Add** on **DOKU Codegen**.

**Step 2 — Fully restart Cursor** (`Cmd+Q`) so the plugin registers.

**Step 3 — Verify**

In Agent chat, run `/generate` and Cursor's Agent should walk you through: detect stack → fetch spec → collect credentials → generate client.

---

## Skills

| Skill | Trigger | Purpose |
|---|---|---|
| `detect-stack` | "detect stack" | Detect project language/framework, save to config |
| `fetch-api-spec` | "fetch DOKU API spec" | Navigate developers.doku.com, extract spec, save to config |
| `setup-project` | "generate DOKU code" | **Main entry point** — runs all prerequisites inline, generates client code |
| `setup-credentials` | "set up DOKU credentials" | Collect CLIENT_ID, SECRET_KEY, environment |
| `mock-test` | "test DOKU integration" | Send test request to sandbox, verify signature |
| `production-checklist` | "production checklist" | Run 8 readiness checks before go-live |
| `upgrade` | "upgrade DOKU client" | Diff old vs new spec, patch only changed files |
| `generate-postman` | "generate Postman collection" | Export Postman collection with signature pre-request script |
| `webhook-receiver` | "add DOKU webhook", "handle DOKU callbacks" | Scaffold inbound notification listener with HMAC-SHA256 verifier and replay guard |

## Slash commands

| Command | Purpose |
|---|---|
| `/generate` | Kick off the main generation flow (payment-method optional argument) |
| `/spec` | Fetch a specific DOKU API spec |
| `/checklist` | Run production readiness checks |
| `/test` | Send a sandbox test request |
| `/postman` | Export a Postman collection |
| `/webhook` | Scaffold an inbound notification / webhook receiver |
| `/save-session` | Save current generation state |
| `/resume-session` | Resume a saved session |

## Agents

| Agent | Handles |
|---|---|
| `sdk-generator` | Writes the client code across all languages, matches existing style, follows standards/ |
| `integration-validator` | Audits generated files for security gaps, missing validation, config protection |

## Hooks

The plugin ships safety and quality hooks that Cursor fires around your edits:

| Event | Purpose |
|---|---|
| `sessionStart` | Warn if doku-codegen is not configured in this project |
| `preToolUse` (Write/Edit) | Block overwriting credential files; guard shared infra + linter/formatter configs |
| `postToolUse` (Write) | Per-language quality checks (Java, Kotlin, Python, Node, Go, PHP): debug output, hardcoded creds, missing validation |
| `stop` | Batch cross-file validation + token/cost tracker |
| `preCompact` | Persist generation state before context compaction |
| `beforeSubmitPrompt` | Nudge to use plugin skills when you ask to generate DOKU code manually |

Scripts live in `scripts/hooks/` and share `scripts/lib/hook-flags.js`.

## Supported Languages & Frameworks

| Language | Framework | Signature | Config |
|---|---|---|---|
| Java | Spring Boot 3 + Feign Client | HMAC-SHA256 / HMAC-SHA512 | `application.yml` |
| Kotlin | Spring Boot 3 | HMAC-SHA256 / HMAC-SHA512 | `application.yml` |
| Python | FastAPI + httpx | HMAC-SHA256 / HMAC-SHA512 | `.env` + `config.py` |
| Node.js | Express + axios | HMAC-SHA256 / HMAC-SHA512 | `.env` + `config.js` |
| Go | Gin + net/http | HMAC-SHA256 / HMAC-SHA512 | `.env` + config |
| PHP | Laravel + Guzzle | HMAC-SHA256 / HMAC-SHA512 | `.env` + config |

Standards for each language live in `standards/`.

## Config File

Credentials and API spec are stored in `.claude/doku-codegen.local.md` at your project root (gitignored automatically). Cursor and Claude Code both consume the same config file.

## Local development install

For editing the plugin locally:

```bash
git clone https://github.com/tricerafi-doku/doku-cursor-codegen-plugin.git
cd doku-cursor-codegen-plugin
mkdir -p ~/.cursor/plugins/local
cp -R plugins/doku-codegen ~/.cursor/plugins/local/doku-codegen
```

Fully restart Cursor.

> Cursor rejects symlinks whose target lives outside `~/.cursor/plugins/local/`. Use `cp -R` and re-copy after edits.

## Design Principles

- **No hardcoded URLs** — always navigates developers.doku.com from root by keyword matching
- **Prerequisite following** — fetches auth/token pages referenced by the main API page
- **Single entry point** — `setup-project` runs missing steps inline automatically
- **Spec versioning** — `API_SPEC_PREVIOUS` archived on every refresh for diffing
- **Responsibility-based skills** — adding a new DOKU API never requires a new skill
