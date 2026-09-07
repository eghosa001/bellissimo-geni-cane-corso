# Bellissimo Geni — Client Intake Checklist

Everything the client must supply before launch. Fill each field; return this file (or reply with the answers). The developer then wires the data into `data/dogs.json`, `data/puppies.json` and the relevant pages, replaces placeholders, and activates payment.

> Data submitted here must be **verified and approved** by the client. The site will never publish unverified health claims, pedigree claims, prices or testimonials. Missing parent/ancestry is shown honestly as "Not recorded".

---

## 1. Business details (fills footer, contact page, JSON-LD, OG)

| Field | Client answer |
|---|---|
| Kennel full legal/display name | Bellissimo Geni Cane Corso |
| EST. year | 2023 |
| Country | Nigeria |
| City / state / exact address | |
| Operating hours | |
| Phone (with country code, digits only) | |
| WhatsApp number (with country code, digits only) | e.g. 2348000000000 |
| Email | |
| Instagram handle | @ |
| TikTok handle | @ |
| Facebook page | |
| YouTube (optional) | |
| Google Business profile (for a reviews/homepage embed) | |
| Registrations / memberships / licenses worth displaying (registry, licensed-kennel status, awarding body, titles) | |
| Third-party pedigree database links (optional external trust signal) | |
| Website production domain | |

## 2. Payment & reservation rules (Phase 7 — required to go live)

| Decision | Client answer |
|---|---|
| Payment provider | (e.g. Paystack, Flutterwave, Stripe, bank transfer) |
| Reservation / deposit amount (NGN) | |
| Full payment or deposit-only? | |
| Refund policy | |
| Cancellation policy | |
| Balance-payment timing (e.g. X% before pickup) | |
| Delivery / shipping rules (cities, cost) | |
| Countries / currencies supported | |
| Reservation validity period (e.g. 72h) | |

## 3. Dog & pedigree records (fills `data/dogs.json`)

For EVERY dog (at minimum: Henry, his Sire/Dam and their parents — up to 7 generations if known):

| Field | Per dog |
|---|---|
| Full registered name | |
| Call name | |
| Sex | |
| Date of birth | |
| Colour | |
| Registration no. / kennel club | |
| Status (e.g. Foundation / Retired / Sire / Dam) | |
| Photo (JPEG/WebP, licensed) | |
| Health tests (only substantiated) | |
| Achievements / titles | |
| Bio/notes | |
| Sire ID | |
| Dam ID | |

Rules: unique stable ID per dog; old-generation dogs without data are recorded as "Not recorded", never invented.

## 4. Puppies & litters (fills `data/puppies.json`)

| Field | Per puppy / litter |
|---|---|
| Puppy name/id | |
| Litter name + whelp date | |
| Sire + Dam (link to dog IDs) | |
| Sex | |
| Colour | |
| Photo | |
| Price (or "Price on enquiry") | |
| Status | AVAILABLE / PAYMENT PENDING / RESERVED / SOLD / COMING SOON / UNAVAILABLE |
| Registration | |

## 5. Content pages (currently TBC placeholders)

- **About**: founder story, kennel history, reason for name, facility/team details
- **Standards & Health**: conformation notes, temperament notes, vaccination schedule, deworming schedule, parent health-test records
- **Socialization**: early handling, sound exposure, crate, transition guide — the kennel's real protocol
- **Testimonials**: approved owner stories with names (or initials) + dog purchased. No unapproved stories.
- **Gallery**: dog portraits, ancestor photos, puppy/litter photos, kennel photos (all licensed; supply as WebP/AVIF or originals + permission)

## 6. Security keys (never committed to the repo)

| Item | Status |
|---|---|
| reCAPTCHA v3 site key + secret | supply separately |
| Payment provider keys (secret) | supply separately |

## 7. Sign-off

- [ ] I confirm every dog, puppy, price and pedigree record above is accurate and approved.
- [ ] I confirm every health claim and testimonial is substantiated and approved.
- [ ] I confirm the WhatsApp number, contact details and social handles are correct and approved for public use.
- [ ] I confirm the payment provider, deposit and refund/cancellation rules.
- [ ] I approve going live.

Client name: ____________   Date: ____________

---

## Where each item lands

| Intake item | Target |
|---|---|
| WhatsApp number | `app.js`, `reserve.html`, `contact.html` (3 places) |
| Contact/social | `contact.html`, `social.html`, footer, JSON-LD |
| Social-proof widgets (Google reviews, Instagram feed) | homepage + `social.html` (widgets added once handles/profile exist) |
| Registrations / credentials | footer badges, `about.html`, `standards.html` |
| Dog records | `data/dogs.json` (+ `pedigree.html`/`dogs.html` render automatically) |
| Puppy records | `data/puppies.json` (+ `puppies.html`, `reserve.html`, homepage render automatically) |
| Photos | `/images/*`, gallery + dog/puppy photo fields, WebP/AVIF |
| Payment rules | `/webhook` handler + provider integration (see `webhook/README.md`) |
| reCAPTCHA | `window.RECAPTCHA_SITE_KEY` in `reserve.html` + server secret |
| Content | `about.html`, `standards.html`, `socialization.html`, `testimonials.html`, `social.html` |