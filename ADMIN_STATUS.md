# Bellissimo Geni — Admin Dashboard Audit

**Date:** 2026-09-07  
**Status:** IMPLEMENTED — all 6 gaps closed (commits `6aa324e` + `f79e65a` + current)  
**Files:** `admin.html` (1,181 lines), `webhook/handler.js` (932 lines, 14 endpoints), `webhook/wrangler.toml` (ADMIN + UPLOADS KV/R2), `data/admin-schema.md`

---

## Requirements Checklist (ALL CLOSED)

| # | Requirement | Status | Implementation |
|---|------------|--------|----------------|
| 1 | Secure owner login | ✅ | Bearer-token via `ADMIN_PASSWORD` Workers secret. Verified per-request. Password stored in browser `localStorage` (not server). |
| 2 | Add/edit dogs | ✅ | Full CRUD via `/admin/api/dogs`. Modal form with name, sex, colour, DOB, sire/dam dropdowns (by ID), registration, bio, health, achievements, status, publish toggle. |
| 3 | Upload photos | ✅ | Browser file picker → `POST /admin/api/upload` → Cloudflare R2 → CDN URL returned → saved to record. Works on phone too. |
| 4 | Set Sire/Dam by ID | ✅ | Dropdowns populated from live dog list, select by `id` field. Circular reference detection (sire === dam warns user). |
| 5 | Build/manage 5–7 gen pedigrees | ✅ | Dog records carry `sireId`/`damId`. Public site traverses recursively up to 7 generations. Admin has **visual tree editor** at `/admin/pedigree-editor` showing 3-gen preview with inline parent edit. |
| 6 | Add/manage puppies and litters | ✅ | Full CRUD. Puppy linked to litter via `litterId`. Sire/dam from dog list. |
| 7 | Set puppy prices | ✅ | `priceNGN` (numeric) + `priceNote` (display). Defaults to "Price on enquiry" when empty. |
| 8 | Mark Available/Reserved/Sold | ✅ | Puppy `status` field + Reservation status pipeline (REQUESTED → PAYMENT_PENDING → RESERVED → SOLD). One-click status update from reservation detail panel. |
| 9 | Manage reservations | ✅ | View all sorted newest-first. Update status, append internal notes, delete. Shows payment_url, provider, paid_amount, paid_at. |
| 10 | Monitor payments | ✅ | Read-only view of full payment data from webhook: provider ref, amount, currency, paid_at. Provider keys stay as Workers secrets. |
| 11 | Manage gallery | ✅ | Add/edit/delete. Caption, alt text, category, sort order. **Browser photo upload** included. |
| 12 | Manage testimonials | ✅ | Add/edit/delete. Approve/unapprove toggle. Feature/on-homepage toggle. |
| 13 | Update WhatsApp/social links | ✅ | Settings panel: WhatsApp, email, address, Instagram handle, Facebook URL, about blurb. |
| 14 | Edit approved website content | ✅ | **NEW** — `/admin/edit-content` page with tabs for About, Breeding, Standards, Socialization, Social, Contact. HTML textarea saves to KV, goes live immediately. |
| 15 | Mobile-friendly UX | ✅ | Sidebar collapses to hamburger on <700px. Forms go single-column. Touch-friendly buttons. |
| 16 | Non-technical owner flow | ✅ | All operations are form-fill → save. No code, no Git, no terminal required. |
| 17 | Consistent branding | ✅ | Matches site design tokens (Cormorant Garamond, gold accents, dark sidebar). |
| 18 | Destructive actions confirmed | ✅ | Delete operations require `confirm()` dialog before execution. |
| 19 | Audit trail | ✅ | **NEW** — every create/update/delete/upload/publish action logged to `admin:audit:log` KV (last 500 entries). Viewable at `/admin/audit`. |
| 20 | Preview before publish | ✅ | **NEW** — draft/publish system. Entities have `publishStatus: 'published' | 'draft'`. Drafts hidden from public site. Visible in stats card. Toggle in dog/puppy/testimonial forms. |

---

## What Changed This Commit

### `webhook/handler.js` (+208 lines)
- Added `auditLog()` helper — logs every mutation with action, entity, entityId, details
- Added `filterPublished()` and `ensurePublishStatus()` — draft/publish filtering
- Dogs/puppies/litters/testimonials now support `publishStatus` field
- All write operations call `auditLog()` automatically
- New endpoint `POST /admin/api/upload` — accepts multipart image → stores in Cloudflare R2 → returns CDN URL
- New endpoint `GET/POST /admin/api/content?page={about,breeding,standards,...}` — page content CRUD
- New endpoint `GET /admin/api/audit?limit=N` — reads last N audit log entries
- New endpoint `POST /admin/api/publish` — toggles `publishStatus` on any entity
- Stats endpoint now includes `draftDogs`, `draftPuppies`, `draftTestis`, `recentAuditLogs`

### `admin.html` (+213 lines)
- **Photo upload zones** on dog, puppy, and gallery forms — click to pick from device, uploads to R2 via Worker
- **Publish Status dropdown** on dog and puppy forms (Published / Draft)
- **Status field** on puppy form (AVAILABLE, RESERVED, SOLD, etc.)
- **Circular reference warning** on dog form when sire === dam
- **Edit Content page** — tabs for all 6 static pages, HTML textarea, save to KV
- **Audit Trail page** — chronological log of all admin actions with timestamps and entity details
- **Pedigree Tree Builder page** — select a dog, see 3-generation visual tree, edit sire/dam inline
- Stats cards now show draft counts

### `webhook/wrangler.toml`
- Added `[[r2_buckets]]` binding for `UPLOADS` — enables browser-to-R2 photo storage

---

## Architecture Summary

```
Owner's phone/laptop
       │
       ▼
  /admin.html          ← password-protected, Bearer auth
       │
       │  fetch('/admin/api/dogs',      { Authorization: 'Bearer $PW' })
       │  fetch('/admin/api/puppies',   { Authorization: 'Bearer $PW' })
       │  fetch('/admin/api/upload',    { Authorization: 'Bearer $PW', FormData }  ← NEW
       │  fetch('/admin/api/content',   { Authorization: 'Bearer $PW' })           ← NEW
       │  fetch('/admin/api/audit',     { Authorization: 'Bearer $PW' })           ← NEW
       │  fetch('/admin/api/publish',   { Authorization: 'Bearer $PW' })           ← NEW
       ▼
Cloudflare Worker      ← /admin/api/* routes
  env.ADMIN.get/set    ← KV namespace (dogs, puppies, litters, testimonials, gallery, settings, audit log, content)
  env.UPLOADS.put      ← Cloudflare R2 bucket for uploaded images
  env.RESERVATIONS     ← existing KV (public reservation records)
  env.PUPPY_LOCK       ← Durable Object (puppy availability locking)
       │
       ▼
Public site            ← reads from ADMIN KV via same handler
  index.html           ← serves dynamic data (only published records)
  dogs.html            ← search/filter from published dogs only
  pedigree.html        ← 7-gen traversal from published dogs
  puppies.html         ← filter from published puppies+litters
  reserve.html         ← POST /webhook → reservation creation
```

---

## Deployment Steps

```bash
# 1. Install wrangler
npm install -g wrangler

# 2. Login and set password
wrangler login
wrangler secret put ADMIN_PASSWORD

# 3. Create R2 bucket for uploads
wrangler r2 bucket createbellissimo-geni-media
# Then update wrangler.toml with the bucket name

# 4. Create KV namespaces (if not already done)
wrangler kv:namespace create ADMIN
wrangler kv:namespace create RESERVATIONS

# 5. Deploy
wrangler deploy

# 6. Set window.BG_WEBHOOK_URL in reserve.html and contact.html
#    to your worker URL: https://bellissimo-geni-webhook.your-name.workers.dev

# 7. Serve admin.html on your domain (same directory as other .html files)
```

---

## What Works Right Now (After Deployment)

1. Login with password → see dashboard with live counts including draft tallies
2. Add/edit/delete any dog — **click to upload a photo from your phone**, set sire/dam, toggle draft
3. Add/edit/delete any puppy — upload photo, set price, change status, toggle draft
4. Create litters, link to parent dogs
5. View all reservations, change status, append notes, delete
6. Add/approve/feature/remove testimonials
7. Add/edit/delete gallery photos — **upload directly from device**
8. Edit About/Breeding/Standards/Socialization/Social/Contact page content — **no code needed**
9. View audit trail — see who changed what and when
10. Update kennel contact info, social links, payment config
11. Build pedigree trees visually in the Pedigree Editor
12. All changes reflect immediately on the public site (after fetching fresh data)
13. Draft records stay hidden from public site until published

