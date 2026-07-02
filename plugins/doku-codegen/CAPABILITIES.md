# doku-codegen — Capabilities

## Generate
- Generate complete DOKU payment client code for **any DOKU API** (Checkout, Virtual Account, QRIS, Alfa, Indomaret, and more)
- Supports **6 languages**: Java, Kotlin, Python, Node.js, Go, PHP
- Auto-detects your project's existing language and framework — no config needed
- Two modes: **add to existing project** (matches your code style) or **full new project**
- Scaffolds an inbound **webhook / notification receiver** with signature verification, replay guard, and 2xx-ack semantics

## Fetch & Stay Current
- Navigates **developers.doku.com live** to fetch the latest API spec — never uses hardcoded definitions
- Prefers agent-native sources (`llms.txt` index, clean-Markdown `<url>.md` variants) with sitemap fallback
- Follows prerequisite cross-references (auth pages, SNAP token docs) automatically
- Stores specs per API in `API_SPECS[<slug>]` — multiple payment methods coexist without overwriting each other
- Re-run anytime to refresh when DOKU updates their API

## Validate & Protect
- **37-point security audit** after generation covering hardcoded secrets, signature correctness, header completeness, API wiring, code quality, and inbound notification safety (N1–N4)
- Auto-fixes safe issues; blocks the release if critical checks fail
- **14 live hooks** guard every file write. Two guards actually block writes (exit 2): `config-protection` on weakened linter/formatter configs and `pre-write-doku-config` on destructive credential-file overwrites (rejects writes that would clear existing `CLIENT_ID` or `SECRET_KEY`). The remaining per-language hooks flag debug prints, hardcoded credentials, and missing validation as advisory findings — you see them in the tool-call output, but the write is not blocked.

## Test & Ship
- Sends a real test request to DOKU sandbox to verify signature and connectivity
- **Production checklist** — 8 automated pre-go-live checks
- Generates a ready-to-import **Postman collection** with signature pre-request script and the correct `/authorization/v1/access-token/b2b` token endpoint

## Session & Workflow
- **Save and resume** long generation sessions across context resets
- **Cost tracking** — logs estimated USD per session to `~/.claude/metrics/`
- Saves generation state before context compaction so nothing is lost
- 8 slash commands: `/doku-codegen:generate`, `/doku-codegen:spec`, `/doku-codegen:test`, `/doku-codegen:checklist`, `/doku-codegen:postman`, `/doku-codegen:webhook`, `/doku-codegen:save-session`, `/doku-codegen:resume-session`
