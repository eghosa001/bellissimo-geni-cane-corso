# Bellissimo Geni Cane Corso

Premium responsive kennel website for Bellissimo Geni Cane Corso, Nigeria.

## Pages

- `index.html` — Home: hero, story, featured dogs/puppies, lineage CTA, standards, bloodlines, gallery preview, owner stories (TBC), reservation CTA, enquiry form
- `dogs.html` — Our Dogs: live search + filter from `data/dogs.json`, full profiles with clickable Sire/Dam (`?dog=id`)
- `puppies.html` — Puppies + upcoming litters from `data/puppies.json`, status pills, reserve links
- `pedigree.html` — Pedigree search: `Search → profile → Sire/Dam → parents → grandparents → 7 generations`. Loads `data/dogs.json` with demo fallback. Deep links: `pedigree.html?dog=Henry`
- `breeding.html` — Breeding programme, standards, health transparency, socialization, reservation rules pending confirmation
- `gallery.html` — Client photo + clearly-marked placeholders
- `reserve.html` — Reservation flow: choose puppy → details + terms → reference (`BG-YYYY-XXXX`, saved to localStorage) → WhatsApp confirm. Payment disabled pending provider.
- `contact.html` — Contact / Apply form via WhatsApp + kennel placeholders

## Data

- `data/dogs.json` — schema v2, 7-generation ready (`id`, `sireId`, `damId`, bio, health, etc.). Development records only.
- `data/puppies.json` — litters + puppies with `AVAILABLE / PAYMENT PENDING / RESERVED / SOLD / COMING SOON / UNAVAILABLE`.

## Run locally

Open `index.html` in a browser, or serve statically (VS Code Live Server / `npx serve`). No framework or build step. GitHub Pages compatible.

## Before launch

1. Replace `WHATSAPP_NUMBER` in `app.js`, `reserve.html`, `contact.html`.
2. Replace demo dogs/puppies/litters, prices, statuses with verified kennel data + photos.
3. Replace placeholders in gallery + homepage art with licensed photography (WebP/AVIF, lazy loading).
4. Add real location, phone, hours, social links.
5. Verify every health/pedigree claim; publish only substantiated records.
6. Confirm payment provider, deposit, refunds, cancellation, balance timing — then integrate secure provider + webhooks (never store cards on site).
7. Replace testimonial placeholders with approved owner stories or remove section.
8. Set production domain in `sitemap.xml` / OG tags, enable Pages.

## Deployment

Static HTML/CSS/JS only. Push to `main` and enable GitHub Pages. No secrets in frontend.
