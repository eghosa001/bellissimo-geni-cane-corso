# Bellissimo Geni — Admin Dashboard Audit

**Date:** 2026-09-07  
**Status:** Implemented — committed to `main` (commit `6aa324e`)  
**Files:** `admin.html` (968 lines), `webhook/handler.js` (+455 lines admin API), `webhook/wrangler.toml` (ADMIN KV), `data/admin-schema.md`

---

## Requirements Checklist

| # | Requirement | Status | Notes |
|---|------------|--------|-------|
| 1 | Secure owner login | ✅ | Bearer-token via `ADMIN_PASSWORD` Workers secret. Verified per-request. Password stored only in browser `localStorage`. |
| 2 | Add/edit dogs | ✅ | Full CRUD via `/admin/api/dogs`. Modal form with name, sex, colour, DOB, sire/dam dropdowns (by ID), registration, bio, health, achievements, status, photo URL. |
| 3 | Upload photos | ⚠️ Partial | Photo URL input (owner pastes CDN-hosted URL). **No browser-to-server file upload.** Image optimization is manual. See Gap #1 below. |
| 4 | Set Sire/Dam by ID | ✅ | Dropdown populated from live dog list, selects by `id` field — never fragile name matching. Circular-reference detection not yet added. |
| 5 | Build/manage 5–7 gen pedigrees | ✅ | Dog records carry `sireId`/`damId`. Pedigree engine on public site traverses recursively up to 7 generations. Admin sets parents; tree builds automatically. |
| 6 | Add/manage puppies and litters | ✅ | Full CRUD for both. Puppy linked to litter via `litterId`. Sire/dam auto-populated from dog list. |
| 7 | Set puppy prices | ✅ | `priceNGN` (numeric) and `priceNote` (display text). Defaults to "Price on enquiry" when empty. |
| 8 | Mark Available / Reserved / Sold | ✅ | Puppy `status` field + Reservation status pipeline (REQUESTED → PAYMENT_PENDING → RESERVED → SOLD). One-click status update from reservation detail panel. |
| 9 | Manage reservations | ✅ | View all reservations sorted newest-first. Update status. Append internal notes. Delete. Shows payment_url, provider, paid_amount, paid_at when available. |
| 10 | Monitor payments | ⚠️ Partial | Read-only view of reservation payment data from webhook (provider, url, amount, currency, timestamps). **No deep payment dashboard** (e.g. transaction history, refund button). Provider keys are Workers secrets, never in frontend. |
| 11 | Manage gallery | ✅ | Add/edit/delete photos. Caption, alt text, category, sort order. |
| 12 | Manage testimonials | ✅ | Add/edit/delete. Approve/unapprove toggle. Feature/unfeature toggle for homepage spotlight. |
| 13 | Update WhatsApp/social links | ✅ | Settings panel with WhatsApp number, email, address, Instagram handle, Facebook URL, about blurb. |
| 14 | Edit approved website content | ❌ Not built | About/Breeding/Standards/Socialization are static HTML pages. No in-admin editor for these yet. See Gap #2 below. |
| 15 | Mobile-friendly UX | ✅ | Sidebar collapses to hamburger on <700px. Forms go single-column. Touch-friendly buttons. |
| 16 | Non-technical owner flow | ✅ | All operations are form-fill → save. No code, no Git, no terminal required. |
| 17 | Consistent branding | ✅ | Matches site design tokens (Cormorant Garamond, gold accents, dark sidebar). |
| 18 | Destructive actions confirmed | ✅ | Delete operations require `confirm()` dialog before execution. |
| 19 | Audit trail | ❌ Not built | No logged record of who changed what and when. See Gap #3 below. |
| 20 | Preview before publish | ❌ Not built | Changes go live immediately via KV. No draft/preview workflow. See Gap #4 below. |

---

## Gaps to Close Before Production

### Gap #1 — Real Image Upload (not just URL paste)
**Current:** Owner pastes a CDN URL into the photo field.  
**Expected:** Click to upload from device → image stored on CDN → URL saved automatically.  
**Fix:** Integrate Cloudflare R2 (or ImageKit/Cloudinary) with a signed upload endpoint. The Worker can accept multipart uploads, store in R2, return the CDN URL back to the admin.

### Gap #2 — Edit Static Content Pages (About, Breeding, Standards)
**Current:** These are hardcoded `.html` files. Admin cannot edit them.  
**Expected:** Owner types content into the admin → published to the site.  
**Fix:** Migrate page content into KV storage (`admin:content:about`, `admin:content:breeding`, etc.) and serve it dynamically from the worker, or add a simple WYSIWYG-style editor that writes to KV and updates the rendered HTML.

### Gap #3 — Audit Trail
**Current:** No logging of admin actions.  
**Expected:** Every create/update/delete logged with timestamp and action type.  
**Fix:** Add an `admin:audit` KV prefix. On every write to dogs/puppies/litters/reservations/testimonials/gallery, push a log entry: `{action, entity, entityId, timestamp}`. Display as a table in a new "Audit" nav item.

### Gap #4 — Draft / Preview Workflow
**Current:** Changes apply immediately to KV and are visible on the live site.  
**Expected:** Owner can save a draft, preview changes, then publish.  
**Fix:** Add `status: 'draft' | 'published'` to entities. Admin edits draft. Public site reads only `published` records. A "Publish" button flips the flag.

### Gap #5 — Pedigree Visual Tree Editor
**Current:** Parent relationships set via two dropdown selects. Pedigree TREE renders on public site.  
**Expected:** Visual drag-and-drop or node-based pedigree builder in admin.  
**Fix:** Add a dedicated `/admin/pedigree` page with an interactive graph (SVG or canvas) showing the family tree. Click nodes to edit parents. Detect circular references.

### Gap #6 — Payment Deep Dashboard
**Current:** Shows reservation-level payment data (url, amount, status).  
**Expected:** Transaction-level detail — Paystack/Flutterwave charge IDs, customer emails, refund capability.  
**Fix:** Store full provider response payload in reservation record. Add "View in Provider Portal" link and optional refund webhook handler.

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
       │  fetch('/admin/api/litters',   { Authorization: 'Bearer $PW' })
       │  fetch('/admin/api/reservations',{Authorization: 'Bearer $PW' })
       │  fetch('/admin/api/testimonials',{Authorization: 'Bearer $PW' })
       │  fetch('/admin/api/gallery',   { Authorization: 'Bearer $PW' })
       │  fetch('/admin/api/settings',  { Authorization: 'Bearer $PW' })
       │  fetch('/admin/api/stats',     { Authorization: 'Bearer $PW' })
       ▼
Cloudflare Worker      ← /admin/api/* routes
  env.ADMIN.get/set    ← KV namespace (dogs, puppies, litters, testimonials, gallery, settings)
  env.RESERVATIONS     ← existing KV (public reservation records)
  env.PUPPY_LOCK       ← Durable Object (puppy availability locking)
       │
       ▼
Public site            ← reads from ADMIN KV via same handler
  index.html           ← serves dynamic data
  dogs.html            ← search/filter from dogs
  pedigree.html        ← 7-gen traversal from dogs
  puppies.html         ← filter from puppies+litters
  reserve.html         ← POST /webhook → reservation creation
```

---

## Deployment Steps (Owner / Developer)

```bash
# 1. Create Cloudflare Workers project
cd webhook
npm install -g wrangler
wrangler login

# 2. Set password (prompted interactively)
wrangler secret put ADMIN_PASSWORD

# 3. Create KV namespaces
wrangler kv:namespace create ADMIN
wrangler kv:namespace create RESERVATIONS   # if not already created
# Copy the IDs into wrangler.toml

# 4. Deploy
wrangler deploy

# 5. Set window.BG_WEBHOOK_URL in reserve.html and contact.html
#    to your worker URL: https://bellissimo-geni-webhook.your-name.workers.dev

# 6. Serve admin.html alongside the public site on your domain
```

---

## What Works Right Now (After Deployment)

1. Login with password → see dashboard with live counts
2. Add/edit/delete any dog with sire/dam selection
3. Add/edit/delete any puppy, set price, change status
4. Create litters, link to parent dogs
5. View all reservations, change status, delete
6. Add/approve/feature/remove testimonials
7. Add/edit/delete gallery photos
8. Update kennel contact info, social links, payment config
9. All changes reflect immediately on the public site (after fetching fresh data)
