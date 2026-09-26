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

The owner CMS and Worker implementation are present. The repository now uses Wrangler automatic provisioning for the ADMIN/RESERVATIONS KV namespaces and R2 media bucket, so account-specific resource IDs are no longer committed or manually pasted.

Production deployment still requires Cloudflare authentication plus:
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
npm install
wrangler deploy
wrangler secret put ADMIN_PASSWORD
```

After deployment, open `admin.html` and enter the Worker URL once on the sign-in screen. It is stored locally on that device; the admin password remains a Worker secret.

## Release gate

Before calling the full production stack complete:

1. Confirm any late puppy identities/listing facts that should be public.
2. Configure Cloudflare KV, R2 and the admin password secret.
3. Decide whether payment should remain enquiry-only or be enabled with approved commercial terms.
4. Run the Website Screenshots workflow and confirm desktop/mobile views.
5. Verify contact, WhatsApp, dogs, pedigree, puppies and reservation flows on the deployed site.

See `IMPLEMENTATION_STATUS.md` for the authoritative handoff state.

## Custom domain activation

The requested production domain is `bellissimogeni.com`, but the repository deliberately does not add a `CNAME` until the domain is owned and its DNS resolves. Once DNS is configured for GitHub Pages, run the **Prepare Bellissimo Custom Domain** workflow. It verifies DNS first and opens a pull request that adds the CNAME and migrates canonical, Open Graph, sitemap, robots and production screenshot URLs in one controlled change.
