# Bellissimo Geni Cane Corso

Premium responsive kennel website for Bellissimo Geni Cane Corso, Nigeria.

## Pages

- `index.html` — Home: hero, story, featured dogs/puppies, lineage CTA, standards, bloodlines, gallery preview, owner stories (TBC), reservation CTA, enquiry form
- `about.html` — About: Founding story, heritage, location, mission (TBC placeholders)
- `dogs.html` — Our Dogs: live search + filter from `data/dogs.json`, full profiles with clickable Sire/Dam (`?dog=id`)
- `puppies.html` — Puppies + upcoming litters from `data/puppies.json`, status pills, reserve links
- `pedigree.html` — Pedigree search: `Search → profile → Sire/Dam → parents → grandparents → 7 generations`. Loads `data/dogs.json` with demo fallback. Deep links: `pedigree.html?dog=Henry`
- `breeding.html` — Breeding programme, standards, health transparency, socialization, reservation rules pending confirmation
- `standards.html` — Standards, health testing, vaccination, deworming (TBC pending client)
- `socialization.html` — Socialization + transition guidance (TBC pending client)
- `gallery.html` — Client photo + clearly-marked placeholders
- `testimonials.html` — Owner stories (placeholders only, approved stories required)
- `social.html` — Social media hub (handles TBC)
- `reserve.html` — Reservation flow: choose puppy → terms + honeypot → reference (`BG-YYYY-XXXX`, saved to localStorage) → WhatsApp confirm → POST `/webhook`
- `contact.html` — Contact / Apply form via WhatsApp (honeypot + phone validation) + kennel placeholders
- `404.html` — Not-found page

## Data

- `data/dogs.json` — schema v2, 7-generation ready (`id`, `sireId`, `damId`, bio, health, etc.). Development records only.
- `data/puppies.json` — litters + puppies with `AVAILABLE / PAYMENT PENDING / RESERVED / SOLD / COMING SOON / UNAVAILABLE`.

## Anti-spam & forms

- Honeypot field (`name="website"`, visually hidden) on all forms; submissions are silently dropped if filled.
- Phone/WhatsApp validation (7–15 digits) via `BG.validPhone`.
- reCAPTCHA v3 scaffold: set `window.RECAPTCHA_SITE_KEY` in `reserve.html` head to enable; tokens are forwarded to the webhook for server-side verification.

## Payment & webhook (Phase 7 — STUB, not live)

Front end already POSTs `{action:'reserve', version, token, data{...}, timestamp}` to `/webhook`. The site never stores card details. See `webhook/README.md` for the implementation contract. Payment (provider, deposit, refunds, cancellation, balance timing, currencies) requires client confirmation before going live.

## Run locally

Open `index.html` in a browser, or serve statically (VS Code Live Server / `npx serve`). No framework or build step. GitHub Pages compatible.

## Before launch

1. Replace `WHATSAPP_NUMBER` in `app.js`, `reserve.html`, `contact.html`.
2. Replace demo dogs/puppies/litters, prices, statuses with verified kennel data + photos.
3. Replace placeholders in gallery + homepage art with licensed photography (WebP/AVIF, lazy loading).
4. Add real location, phone, hours, social links; fill `about.html`, `standards.html`, `socialization.html`, `social.html` TBC fields.
5. Verify every health/pedigree claim; publish only substantiated records.
6. Replace testimonial placeholders with approved owner stories.
7. Implement `webhook/` handler (server-side reCAPTCHA verify, idempotent reservation, provider, signature + webhook verification). Never store cards, never trust client-side state.
8. Set production domain in `sitemap.xml` / OG tags; enable Pages.

## Deployment

Static HTML/CSS/JS only. Push to `main` and enable GitHub Pages. No secrets in frontend.
