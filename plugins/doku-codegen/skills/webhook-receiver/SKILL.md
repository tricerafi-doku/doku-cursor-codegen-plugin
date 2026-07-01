---
name: webhook-receiver
description: Generate an inbound DOKU notification / webhook receiver — signature verifier, replay guard, and controller/route in the project's language. Use when the user says "add DOKU notification receiver", "set up webhook", "handle DOKU callbacks", or "verify DOKU notification signature", or after generating a client that needs to receive payment status updates.
tools: Read, Write, Bash, AskUserQuestion
origin: doku-codegen
---

# doku-codegen — Webhook Receiver

Scaffold the inbound-notification listener that DOKU calls to deliver payment-status updates. Merchants that skip this either miss webhook events or (worse) accept spoofed notifications.

**What this skill produces:**

1. A notification controller/route in the project's stack — mounted at a configurable path (default `/payments/notifications`).
2. An inbound-signature verifier that validates the HMAC-SHA256 the DOKU signs each notification with.
3. A `Request-Id` replay-guard cache so replayed notifications are rejected.
4. Standard-shape 2xx-ack response (DOKU expects a 2xx quickly; heavy processing runs async).

---

## Step 1: Load Config

```bash
cat .claude/doku-codegen.local.md 2>/dev/null || echo "FILE_NOT_FOUND"
```

Required in config:
- `LANGUAGE` / `FRAMEWORK` — target stack
- `CLIENT_ID` — used as the `expectedClientId` constant in the verifier
- `SECRET_KEY` — used to compute the expected HMAC

If any are missing, dispatch to `setup-project` first — this skill is not the entry point.

---

## Step 2: Ask Configuration Questions

Ask (AskUserQuestion):

1. **Notification path** — "Which URL path should DOKU call for notifications?"
   - Default: `/payments/notifications`
   - Store as `NOTIFICATION_PATH`.

2. **Replay guard storage** — "Where to store seen `Request-Id`s for replay protection?"
   - In-memory Map (single instance, restart-clears — dev/test)
   - Redis (multi-instance safe — production)
   - Database table (persistent audit trail — regulated environments)
   - Store as `REPLAY_STORE`.

3. **Processing model** — "How to handle the notification body once verified?"
   - Log-only stub (integrator fills in later)
   - Queue publish (name of queue/topic — integrator fills in)
   - Direct database update (integrator fills in)
   - Store as `PROCESSING_MODEL`.

Save all three to config.

---

## Step 3: Dispatch to sdk-generator

Pass this context to the `sdk-generator` agent:

```
LANGUAGE:          [from config]
FRAMEWORK:         [from config]
MODE:              [add-to-existing | new-project]
NOTIFICATION_PATH: [from Step 2]
REPLAY_STORE:      [in-memory | redis | database]
PROCESSING_MODEL:  [log-only | queue | db-update]
API_SPEC:          [full active spec block]
PROJECT_LAYOUT:    [PROJECT_LAYOUT from setup-project, if add-to-existing]
```

Instruct the agent to generate:

**A. Notification controller / route**
- Endpoint at `NOTIFICATION_PATH`, HTTP `POST`
- Reads the raw request body as a string (do NOT parse-then-reserialize — signature is over the raw body)
- Reads the DOKU headers: `Client-Id`, `Request-Id`, `Request-Timestamp`, `Signature`
- Rejects with 400 if any header is missing
- Delegates to the verifier (below)

**B. Inbound-signature verifier**
- Non-SNAP HMAC-SHA256 over the string:
  ```
  Client-Id:<value>
  Request-Id:<value>
  Request-Timestamp:<value>
  Request-Target:<NOTIFICATION_PATH>
  Digest:<Base64(SHA-256(rawBody))>
  ```
  (newline-separated, no trailing newline)
- Constant-time comparison (language-idiomatic: `hmac.compare_digest` in Python, `MessageDigest.isEqual` in Java, `crypto.timingSafeEqual` in Node, etc.).
- Reject with 400 on mismatch.
- Reject with 400 if `Client-Id` header != expected merchant `CLIENT_ID` from config.

**C. Request-Id replay guard**
- Before running signature verify, check if `Request-Id` is already in `REPLAY_STORE`.
- If yes → 200 OK (idempotent ack; do not re-process).
- If no → proceed to verify; on success, insert `Request-Id` into `REPLAY_STORE` with a 24-hour TTL, then process.

**D. 2xx-ack semantics**
- On verified notification: acknowledge immediately with 200 OK and the DOKU-expected body shape:
  ```json
  {"responseCode": "2000000", "responseMessage": "Successful"}
  ```
- Only then start the processing action (`PROCESSING_MODEL`). If processing fails, log — do NOT return an error to DOKU (they will retry indefinitely and multiply the failure).

**E. HTTPS-only note**
- Emit a `README.md` section explaining the endpoint must be exposed over HTTPS in production; DOKU will not send notifications to plain-HTTP endpoints in prod.

---

## Step 4: Confirm

After the agent completes, print:

```
✅ Webhook receiver generated for [LANGUAGE]/[FRAMEWORK]

Files:
  - [notification controller path]
  - [verifier path]
  - [replay store adapter path]

Endpoint:      POST [NOTIFICATION_PATH]
Signature:     HMAC-SHA256 over Non-SNAP string-to-sign
Replay store:  [REPLAY_STORE]
Processing:    [PROCESSING_MODEL] (stub — fill in with your handler)

Next steps:
  1. Register [NOTIFICATION_PATH] as your notification URL in the DOKU Back Office.
  2. Expose the endpoint over HTTPS (DOKU rejects http:// in production).
  3. Fill in the processing stub with your business logic.
  4. Run /doku-codegen:checklist to confirm the receiver passes the production audit.
```
