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

Production deployment still requires repository Actions secrets for:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `BELLISSIMO_ADMIN_PASSWORD`

Payment remains deliberately disabled:
- `PAYMENT_PROVIDER = "none"`
- `RESERVATION_AMOUNT = "0"`

Do not enable payment until the kennel confirms provider, deposit amount, refund/cancellation terms and balance-payment rules.

## Deploying the public site

Push/merge verified work to `main`. The GitHub Pages workflow deploys automatically.

## Deploying the Worker

Use the **Deploy Bellissimo Worker** GitHub Actions workflow after the three required secrets are configured. The workflow tests the Worker, auto-provisions KV/R2, deploys it, seeds the verified baseline records exactly once, and opens a small configuration PR that connects the public site and admin panel to the deployed Worker. Later CMS edits are never overwritten by redeployment.

## Release gate

Before calling the full production stack complete:

1. Confirm any late puppy identities/listing facts that should be public.
2. Configure the Cloudflare deployment secrets and run **Deploy Bellissimo Worker**.
3. Merge the generated Worker configuration PR.
4. Decide whether payment should remain enquiry-only or be enabled with approved commercial terms.
5. Run the Website Screenshots workflow and confirm desktop/mobile views.
6. Verify contact, WhatsApp, dogs, pedigree, puppies and reservation flows on the deployed site.

See `IMPLEMENTATION_STATUS.md` for the authoritative handoff state.

## Custom domain activation

The requested production domain is `bellissimogeni.com`. Configure a repository secret named `PAGES_ADMIN_TOKEN` with permission to manage GitHub Pages, then run **Prepare Bellissimo Custom Domain**. The workflow registers the domain in GitHub Pages first, verifies all four required apex A records, and only then opens the activation PR that migrates canonical, Open Graph, sitemap, robots and production screenshot URLs. HTTPS is enabled automatically when GitHub reports the certificate ready.
