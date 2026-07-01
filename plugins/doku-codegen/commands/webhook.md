---
name: webhook
description: Scaffold a DOKU notification / webhook receiver — signature verifier, replay guard, and controller/route in the project's language.
argument-hint: [notification-path]
---

# /doku-codegen:webhook

Invokes the **doku-codegen:webhook-receiver** skill.

## Usage

```
/doku-codegen:webhook
/doku-codegen:webhook /callbacks/doku
```

## What it does

Generates the inbound-notification listener DOKU calls when a payment status changes:

1. Notification controller / route in your project's stack
2. Inbound HMAC-SHA256 signature verifier (Non-SNAP)
3. `Request-Id` replay-guard cache (in-memory / Redis / DB — you pick)
4. 2xx-ack response so DOKU stops retrying

## Prerequisite

Run `/doku-codegen:setup-project` first if the project has no DOKU client yet — the webhook-receiver reuses `PROJECT_LAYOUT` and the active `API_SPEC` from config.
