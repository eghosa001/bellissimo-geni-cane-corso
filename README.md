# Bellissimo Geni Cane Corso

Production website for **ALLEVAMENTO BELLISSIMO GENI**, Nigeria.

## Current status

The public website is deployed through GitHub Pages and the current visual baseline is approved for continued use. Core public experiences are implemented:

- premium responsive homepage
- Our Dogs and Past Productions
- direct dog profiles with verified sire/dam navigation
- pedigree search and multi-generation ancestry traversal
- puppies and litters with verification-safe empty states
- reservation enquiry flow
- verified Bellissimo Geni social links
- verified phone, WhatsApp and email contact routes
- owner/admin CMS code and Cloudflare Worker code
- automated responsive screenshots and smoke tests

The website intentionally **does not publish unverified puppy identities, prices, health claims or payment terms**.

## Verified business contact

- Phone / WhatsApp number: +234 913 780 6866
- Email: Bellissimogenicanecorso@gmail.com
- Direct WhatsApp: https://wa.me/message/YSFP25LSDD7AP1
- Instagram: @bellissimogeni
- TikTok: @bellissimogeni
- Facebook: Kelvin Ezekiel Omigie

The canonical contact values used by frontend JavaScript are centralized in `site.js`.

## Data

Public dog data is in `data/dogs.json`.
Public puppy/litter data is in `data/puppies.json`.

Only kennel-supplied and verified facts should be added. Do not invent missing pedigree, registration, availability, price or health information.

Late puppy photographs supplied on 24 September 2026 are published only in a clearly labelled kennel-photography gallery. They remain outside the puppy availability/listing model until identities, litter relationship, sex and availability are confirmed.

## Backend / admin

The owner CMS and Worker implementation are present, but production Cloudflare infrastructure is not configured in the repository yet.

`webhook/wrangler.toml` still requires real:
- RESERVATIONS KV namespace ID
- ADMIN KV namespace ID
- R2 media bucket
- ADMIN_PASSWORD Worker secret

Payment remains deliberately disabled:
- `PAYMENT_PROVIDER = "none"`
- `RESERVATION_AMOUNT = "0"`

Do not enable payment until the kennel confirms provider, deposit amount, refund/cancellation terms and balance-payment rules.

## Deploying the public site

Push/merge verified work to `main`. The GitHub Pages workflow deploys automatically.

## Deploying the Worker

From `webhook/`:

```bash
npm install
wrangler login
wrangler kv namespace create ADMIN
wrangler kv namespace create RESERVATIONS
wrangler r2 bucket create bellissimo-geni-media
wrangler secret put ADMIN_PASSWORD
wrangler deploy
```

After deployment, set `window.BG_WEBHOOK_URL` to the deployed Worker URL on pages that use backend data/reservations.

## Release gate

Before calling the full production stack complete:

1. Confirm any late puppy identities/listing facts that should be public.
2. Configure Cloudflare KV, R2 and the admin password secret.
3. Decide whether payment should remain enquiry-only or be enabled with approved commercial terms.
4. Run the Website Screenshots workflow and confirm desktop/mobile views.
5. Verify contact, WhatsApp, dogs, pedigree, puppies and reservation flows on the deployed site.

See `IMPLEMENTATION_STATUS.md` for the authoritative handoff state.
