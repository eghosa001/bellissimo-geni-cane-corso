# Bellissimo Geni — Client Intake / Outstanding Decisions

This file now contains **only information still needed**. Completed fields were removed so future work does not repeat already-finished WhatsApp requests.

## 1. Late puppy photographs
For each photograph supplied on 24 September 2026, provide or confirm:
- puppy name or internal identifier
- sex
- date of birth/litter
- sire
- dam
- colour
- current status: AVAILABLE / PAYMENT PENDING / RESERVED / SOLD / COMING SOON / UNAVAILABLE
- whether it should appear as a puppy listing or gallery-only image

Do not infer these values from appearance.

## 2. Cloudflare production setup
Needed before the owner CMS can be used in production:
- ADMIN KV namespace
- RESERVATIONS KV namespace
- R2 media bucket
- strong ADMIN_PASSWORD stored as a Worker secret
- final deployed Worker URL

Never commit passwords, API keys or private credentials.

## 3. Reservation/payment policy
Current website is enquiry-first. If online deposit payment is required, confirm:
- Paystack, Flutterwave or another approved provider
- deposit amount in NGN
- reservation hold duration
- refund policy
- cancellation policy
- remaining-balance schedule
- whether international buyers follow different terms

Until those details are approved, payment remains disabled.

## Already confirmed — do not request again
- Phone: +234 913 780 6866
- Email: Bellissimogenicanecorso@gmail.com
- WhatsApp direct link supplied
- Instagram @bellissimogeni
- TikTok @bellissimogeni
- Facebook Kelvin Ezekiel Omigie
- kennel branding and existing verified dog/pedigree information already present in the repository
