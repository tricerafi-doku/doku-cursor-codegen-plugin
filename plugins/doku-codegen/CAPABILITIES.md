# doku-codegen — Capabilities

## Generate
- Generate complete DOKU payment client code for **any DOKU API** (Checkout, Virtual Account, QRIS, Alfa, Indomaret, and more)
- Supports **6 languages**: Java, Kotlin, Python, Node.js, Go, PHP
- Auto-detects your project's existing language and framework — no config needed
- Two modes: **add to existing project** (matches your code style) or **full new project**

## Fetch & Stay Current
- Navigates **developers.doku.com live** to fetch the latest API spec — never uses hardcoded definitions
- Follows prerequisite cross-references (auth pages, SNAP token docs) automatically
- Re-run anytime to refresh when DOKU updates their API

## Validate & Protect
- **22-point security audit** after generation (signature correctness, no hardcoded secrets, all required headers, model completeness)
- Auto-fixes safe issues; blocks the release if critical checks fail
- **13 live hooks** guard every file write: blocks debug prints, hardcoded credentials, weakened linter configs, and accidental overwrite of your credentials file

## Test & Ship
- Sends a real test request to DOKU sandbox to verify signature and connectivity
- **Production checklist** — 8 automated pre-go-live checks
- Generates a ready-to-import **Postman collection** with signature pre-request script

## Session & Workflow
- **Save and resume** long generation sessions across context resets
- **Cost tracking** — logs estimated USD per session to `~/.claude/metrics/`
- Saves generation state before context compaction so nothing is lost
- 7 slash commands: `/doku-codegen:generate`, `/doku-codegen:spec`, `/doku-codegen:test`, `/doku-codegen:production-checklist`, `/doku-codegen:generate-postman`, `/doku-codegen:save-session`, `/doku-codegen:resume-session`
