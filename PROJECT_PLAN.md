# Bellissimo Geni — Remaining Production Plan

This file supersedes older discovery notes that are now obsolete.

## Locked baseline

Do not redesign the approved homepage or reopen superseded WhatsApp requests unless a regression is proven.

Confirmed completed:
- ALLEVAMENTO BELLISSIMO GENI branding and logo placement
- mobile quick-nav order: Our Dogs → Puppies → Menu
- Anthie Custodi Nos naming
- Branco, Karma, Anthie, Tessa, Daisy, Gyda and Twice As Tall Eden records currently published from verified data
- separate Our Dogs and Past Productions
- direct dog profile links
- sire/dam navigation and pedigree traversal
- supplied social links
- supplied puppy-section photography
- dog-photo anti-cropping rules
- owner display for current dogs
- homepage copy cleanup

## Implemented in the latest fix branch

- verified phone +234 913 780 6866
- verified email Bellissimogenicanecorso@gmail.com
- verified direct WhatsApp link
- WhatsApp enquiry submission uses the real number
- reservation confirmation uses the real number
- homepage structured data includes verified phone/email
- obsolete placeholder contact number removed from active scripts
- documentation reconciled with the actual repository state

## Still dependent on client or infrastructure input

### Late puppy media
Six kennel-supplied puppy/young-dog photographs arrived with voice notes. They must not be converted into named/available puppy records until the voice-note meaning or equivalent written facts confirm:
- which image belongs to which puppy
- puppy name/identifier
- sex
- litter/sire/dam relationship
- current availability/status
- whether each image is intended for public listing, general gallery use, or internal reference

### Cloudflare production configuration
Wrangler now auto-provisions ADMIN KV, RESERVATIONS KV and the R2 media bucket. The deployment workflow seeds verified baseline records once and opens the backend configuration PR automatically. The remaining production inputs are the Cloudflare API token/account ID, the admin-password secret, running the deployment workflow, and merging the generated configuration PR.

### Custom domain
Repository-side activation is implemented. Final activation still depends on control of `bellissimogeni.com`, the required GitHub Pages DNS records, and a `PAGES_ADMIN_TOKEN` secret with Pages/Administration write access.

### Payment
Payment remains disabled by design until approved:
- provider
- deposit amount
- refund/cancellation policy
- reservation hold rule
- balance-payment timing

## Final QA gate

After any remaining content/backend changes:
- responsive homepage test
- direct dog profile test
- pedigree parent navigation test
- puppy empty/listing state test
- verified contact link test
- WhatsApp prefilled enquiry test
- reservation route test
- no horizontal overflow at mobile widths
- image load and object-fit checks
- GitHub Pages deployment success
