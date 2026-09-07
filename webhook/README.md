# Bellissimo Geni — Reservation + Payment webhook

Real serverless handler (Cloudflare Workers, ESM, zero dependencies). Replaces the former stub.

## Routes

| Route | Method | Purpose |
| --- | --- | --- |
| `/webhook` or `/webhook/reserve` | POST | Create reservation (idempotent), verify reCAPTCHA, initiate payment |
| `/webhook/payment` | POST | Provider callback; verifies signature, transitions status |
| `/webhook/health` | GET | `{ok:true}` |

## Front end contract

`reserve.html` posts to `window.BG_WEBHOOK_URL` when set (empty until deployed):

```json
{
  "action": "reserve",
  "version": 2,
  "token": "<recaptcha-v3-token or null>",
  "data": { "puppy", "puppyName", "name", "phone", "email", "message", "ref", "status": "REQUESTED" },
  "timestamp": "ISO"
}
```

Server returns `{ok, ref, status, payment_url}` (`payment_url` only when a provider is configured).

## Status machine

`REQUESTED -> PAYMENT_PENDING -> RESERVED -> SOLD`, plus `CANCELLED`. Transitions happen only server-side. Client-supplied status is ignored.

## Security properties

- Server-side validation: name length, phone normalized to 7–15 digits (incl. `+234`), email format, puppy id, message cap 500 chars; zero-width chars stripped; `<`/`>` stripped.
- Optional puppy-catalog check via `PUPPY_CATALOG` (JSON array of ids) — rejects unknown puppies.
- Timestamp skew check (±10 min) to block replays.
- reCAPTCHA v3 verified server-side when `RECAPTCHA_SECRET` is set; demands score ≥ 0.5 and matching action (`reserve`).
- Advisory rate limiting on KV: max 10 requests/hr per IP, 5/day per phone (protects the pre-captcha dev build too).
- Idempotent: same client ref returns existing record; cancelled refs return `409`.
- Puppy availability lock via a Durable Object per puppy (`PuppyLock`, bound `PUPPY_LOCK`):
  - Serialized per puppy, so two people cannot both claim the same puppy.
  - `REQUESTED/PAYMENT_PENDING` holds expire after `RESERVATION_HOLD_HOURS` (default 72).
  - `RESERVED` (deposit paid) holds forever; `SOLD` is permanent; `CANCELLED` releases the puppy.
  - Payment confirmation re-checks the caller still holds the lock before marking `RESERVED`.
  - If no DO binding is configured the lock is skipped (dev), with a warning in logs.
- Provider signature verification — never trust client state:
  - **Paystack**: HMAC-SHA512 over raw body vs `x-paystack-signature`, event must be `charge.success`.
  - **Flutterwave**: re-verifies the transaction server-side via `GET /v3/transactions/{id}/verify` (status `successful`).
- Amount + currency strictly enforced against `RESERVATION_AMOUNT` / `PAYMENT_CURRENCY` (mismatch → `402`). Payments for the wrong amount or currency are rejected, never accepted.
- Rejected/already-processed callbacks are idempotent (`200 ignored:true`) — no double marking.
- KV write failures are surfaced as `500` (record is never reported as saved when it was not).
- No card/PAN data is stored anywhere; providers process cards.
- Secrets live only in worker secrets/env, never in the front end.

## KV record

Keyed by ref (`BG-YYYY-XXXX`). Stores name, phone, email, message, puppy, status, payment url/ref, provider, paid amount/currency, ISO timestamps. 180-day TTL.

## Environment

| Variable | Meaning |
| --- | --- |
| `RESERVATIONS` | KV namespace binding |
| `PUPPY_LOCK` | Durable Object binding (`class_name = "PuppyLock"`) — required for puppy-availability locking |
| `PAYMENT_PROVIDER` | `none` \| `paystack` \| `flutterwave` |
| `PAYSTACK_SECRET` | Paystack secret key (when provider) |
| `FLUTTERWAVE_SECRET` | Flutterwave secret key (when provider) |
| `RESERVATION_AMOUNT` | Deposit/full amount in major units |
| `PAYMENT_CURRENCY` | e.g. `NGN` |
| `RESERVATION_HOLD_HOURS` | Enquiry hold before a puppy is releasable (default 72) |
| `PUPPY_CATALOG` | Optional JSON array of puppy ids to accept (e.g. `["puppy-1"]`) |
| `PAYMENT_RETURN_URL` | Callback the payer is sent back to |
| `RECAPTCHA_SECRET` | reCAPTCHA v3 site secret (empty = skip) |
| `NOTIFY_URL` | Optional URL that receives `{event,ref,status,puppy}` on transitions |

## Deploy

```sh
cd webhook
npx wrangler login
npx wrangler kv namespace create RESERVATIONS   # paste id into wrangler.toml
npx wrangler secret put PAYSTACK_SECRET
npx wrangler deploy
```

Set the deployed URL in `reserve.html` → `window.BG_WEBHOOK_URL` and, for the reCAPTCHA badge to work, register the worker origin in the reCAPTCHA console.

## Tests

```sh
cd webhook
npm run check   # node --check handler.js
npm test        # node --test (7 tests: sanitize, phone, email, ref, validation, skew, transitions)
```

## Blocker

Live initiation still requires the client's Phase 7 decisions (provider choice, deposit vs full amount, refund/cancellation rules) — see `CLIENT_INTAKE.md`.