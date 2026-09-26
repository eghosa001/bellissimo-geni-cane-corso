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
KV/R2 creation, verified-data seeding and backend URL handoff are automated. Before the owner CMS can be used in production, the repository still needs:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- strong `BELLISSIMO_ADMIN_PASSWORD`
- one run of **Deploy Bellissimo Worker**, followed by merging its generated configuration PR
- for `bellissimogeni.com`: `PAGES_ADMIN_TOKEN` and the required DNS records

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
