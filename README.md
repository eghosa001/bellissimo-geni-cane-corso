# Bellissimo Geni Cane Corso

Premium responsive kennel website for Bellissimo Geni Cane Corso, Nigeria.

## Architecture

```
Public Site (GitHub Pages)          Cloudflare Worker
├─ index.html ──────────────────→ /api/dogs (published only)
├─ dogs.html      ──────────────→ /api/puppies (published only)
├─ puppies.html   ──────────────→ /api/gallery (all gallery photos)
├─ gallery.html   ──────────────→ /api/testimonials (approved + published)
├─ testimonials.html                /api/content?page=about,...
└─ reserve.html                     /webhook (reservation POST)

Admin Dashboard (same domain)
└─ admin.html ──────────────────→ /admin/api/* (authenticated)
   ├─ POST /admin/api/login         issues session token
   ├─ GET/POST /admin/api/dogs      dog CRUD
   ├─ GET/POST /admin/api/puppies   puppy/litter CRUD
   ├─ POST /admin/api/upload        browser → R2 photo upload
   ├─ POST /admin/api/content       page HTML editor
   ├─ GET /admin/api/audit          last 500 actions
   └─ ... (full CRUD for all entities)
```

## Before launch — client needs to complete

See **[CLIENT_INTAKE.md](CLIENT_INTAKE.md)** — a fill-in form covering payment/rules, dog & puppy records, contact/social details, photos, content and security keys.

## Pages

- `index.html` — Home: hero, story, featured dogs/puppies, lineage CTA, standards, bloodlines, gallery preview, owner stories (TBC), reservation CTA, enquiry form
- `about.html` — About: Founding story, heritage, location, mission (TBC placeholders)
- `dogs.html` — Our Dogs: live search + filter, full profiles with clickable Sire/Dam (`?dog=id`)
- `puppies.html` — Puppies + upcoming litters, status pills, reserve links
- `pedigree.html` — Pedigree search up to 7 generations from `data/dogs.json`
- `breeding.html` — Breeding programme, standards, health transparency
- `standards.html` — Standards, health testing, vaccination (TBC pending client)
- `socialization.html` — Socialization + transition guidance (TBC pending client)
- `gallery.html` — Client photos + clearly-marked placeholders
- `testimonials.html` — Owner stories (placeholders until approved)
- `reserve.html` — Reservation flow: choose puppy → terms + honeypot → WhatsApp confirm → POST `/webhook`
- `contact.html` — Contact / Apply form via WhatsApp (honeypot + phone validation)
- `admin.html` — **Owner CMS**: password-protected dashboard for managing all content

## Data

The public site reads from **two sources** depending on deployment state:

1. **Local JSON fallback** (`data/dogs.json`, `data/puppies.json`) — used when the Worker is not yet deployed or unreachable
2. **Worker API** (`/api/dogs`, `/api/puppies`, etc.) — used when `window.BG_WEBHOOK_URL` is set

The admin panel writes to Cloudflare KV. The public site reads published records from the same KV via the Worker's unauthenticated `/api/*` endpoints.

## Admin CMS

The owner manages all content through `admin.html`:

- **Dogs & puppies**: add/edit/delete with sire/dam linking, photo upload (browser → R2), publish/draft toggle
- **Litters**: group puppies, set whelp dates
- **Reservations**: view all, update status (REQUESTED → SOLD), append notes
- **Gallery**: upload photos, caption, category, sort order
- **Testimonials**: approve/unapprove, feature on homepage
- **Content pages**: edit About/Breeding/Standards/Socialization HTML directly
- **Audit trail**: every action logged with timestamp and entity
- **Settings**: WhatsApp number, social links, payment config

## Running locally

Open `index.html` in a browser, or serve statically:

```bash
npx serve .
```

## Deploying the Worker

The admin CMS requires a Cloudflare Workers deployment:

```bash
cd webhook
npm install
wrangler login

# Set the admin password (store securely — never commit this)
wrangler secret put ADMIN_PASSWORD

# Create KV namespaces
wrangler kv:namespace create ADMIN
wrangler kv:namespace create RESERVATIONS
# Copy the IDs into webhook/wrangler.toml

# Create R2 bucket for photo uploads
wrangler r2 bucket create bellissimo-geni-media
# Copy the bucket name into webhook/wrangler.toml

# Deploy
wrangler deploy
```

Then set `window.BG_WEBHOOK_URL` in each public HTML file to your deployed URL:

```html
<script>window.BG_WEBHOOK_URL = 'https://bellissimo-geni-webhook.your-name.workers.dev';</script>
```

## Deploying the Public Site

Push to `main` and enable GitHub Pages in repository settings. The `.github/workflows/pages.yml` handles CI/CD automatically. The `webhook/` directory is excluded from the Pages build.

## Before launch checklist

1. Deploy the Worker (see above) and set `BG_WEBHOOK_URL` in all public pages
2. Set `ADMIN_PASSWORD` secret on the Worker
3. Create KV namespaces and R2 bucket, fill IDs into `wrangler.toml`
4. Replace `WHATSAPP_NUMBER` in `app.js` (line 1) with real business number
5. Replace demo dogs/puppies/litters in `data/*.json` with verified kennel data
6. Upload real photography via the admin panel (or replace local files)
7. Add real location, phone, hours, social links
8. Verify every health/pedigree claim before publishing
9. Replace testimonial placeholders with approved owner stories
10. Test the reservation flow end-to-end with a live payment provider if enabled
