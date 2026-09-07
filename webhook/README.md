# Bellissimo Geni — Serverless / webhook provider
#
# STATUS: STUB — NOT LIVE. This documents the reservation + payment webhook
# contract that the site's front end already posts to at POST /webhook.
# Once the client confirms the payment provider and reservation rules
# (Phase 7), implement this handler with:
#   - Server-side reCAPTCHA verification (v3 site secret)
#   - Idempotent reservation creation keyed by client reservation ref
#   - Payment provider initiation + secure signature verification
#   - Webhook signature verification (never trust client-supplied state)
#   - Status transitions: REQUESTED -> PAYMENT_PENDING -> RESERVED -> SOLD
#   - Notifications to the kennel (WhatsApp/email)
#
# The front end already sends:
#   POST /webhook
#   { "action":"reserve", "version":2,
#     "token":"<recaptcha-v3-token>",            // only if site key set
#     "data": { "puppy","puppyName","name","phone","email","message",
#               "ref","status":"REQUESTED" },
#     "timestamp":"<ISO>" }
#
# IMPORTANT: Do not store card/PAN details here. The provider processes cards.
# Keep the reCAPTCHA secret and any provider secret in server environment
# variables, never in the front end.

# Function entry point (target-language agnostic pseudo-contract)
def handle(request):
    # 1. Verify reCAPTCHA token (skip pre-captcha dev build)
    # 2. Validate + normalize payload (strip zero-widths, sanitize, length caps)
    # 3. upsert reservation by client ref (idempotent)
    # 4. Initiate payment with provider; return payment_url + provider id
    # 5. Register webhook route to verify provider signature on callback
    pass
