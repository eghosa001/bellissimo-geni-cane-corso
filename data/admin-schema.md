# Bellissimo Geni — Admin Dashboard Schema

## Overview

The admin panel (`admin.html`) communicates with the Cloudflare Worker at `/admin/api/*`.
Authentication is Bearer-token based using `ADMIN_PASSWORD` set as a Workers secret.

All data is stored in the **ADMIN** KV namespace. The existing **RESERVATIONS** KV namespace continues to serve public reservation webhooks.

---

## KV Key Patterns

| Purpose | KV Key Pattern | Example |
|---------|---------------|---------|
| Dog records | `admin:dogs:<id>` | `admin:dogs:dog-1725000001-a1b2` |
| Puppy records | `admin:puppies:<id>` | `admin:puppies:puppy-1725000002-c3d4` |
| Litter records | `admin:litters:<id>` | `admin:litters:litter-1725000003-e5f6` |
| Testimonials | `admin:testimonials:<id>` | `admin:testimonials:testi-1725000004-g7h8` |
| Gallery photos | `admin:gallery:<id>` | `admin:gallery:gal-1725000005-i9j0` |
| Kennel settings | `admin:settings` | *(single key)* |
| Reservations (public webhook) | `reservation:<REF>` | `reservation:BG-2026-ABCD` |
| Rate-limit counters | `rate:ip:...` / `rate:phone:...` | *(auto-managed by handler)* |

---

## API Endpoints

### Auth
All `/admin/api/*` endpoints require header:
```
Authorization: Bearer <ADMIN_PASSWORD>
```

---

### Stats (read-only)
```
GET /admin/api/stats
```
Returns summary counts + recent 10 reservations.

---

### Dogs
```
GET  /admin/api/dogs              → list all
GET  /admin/api/dogs?id={id}      → single dog
POST /admin/api/dogs              → create
POST /admin/api/dogs?id={id}      → update
DELETE /admin/api/dogs?id={id}    → delete
```

**Dog object:**
```json
{
  "id": "dog-1725000001-a1b2",
  "name": "Henry",
  "sex": "male",
  "colour": "Black",
  "dateOfBirth": "2023-03-15",
  "photo": "https://cdn.example.com/henry.jpg",
  "gallery": ["url1","url2"],
  "registration": "AKC #12345",
  "status": "active",
  "sireId": "dog-xxx",
  "damId": "dog-yyy",
  "bloodline": "",
  "health": "",
  "achievements": "",
  "bio": ""
}
```

---

### Puppies
```
GET  /admin/api/puppies           → list all (+ litters + dogs for select lists)
GET  /admin/api/puppies?id={id}   → single puppy
POST /admin/api/puppies           → create
POST /admin/api/puppies?id={id}   → update
DELETE /admin/api/puppies?id={id} → delete
```

**Puppy object:**
```json
{
  "id": "puppy-1725000002-c3d4",
  "name": "Leo",
  "sex": "male",
  "colour": "Fawn",
  "dateOfBirth": "2026-01-10",
  "litterId": "litter-2026-a",
  "sireId": "dog-harry",
  "damId": "dog-bella",
  "photo": "",
  "priceNGN": 4500000,
  "priceNote": "₦4,500,000",
  "status": "AVAILABLE",
  "registration": "",
  "notes": ""
}
```

**Status values:** `AVAILABLE` | `PAYMENT PENDING` | `RESERVED` | `SOLD` | `COMING SOON` | `UNAVAILABLE`

---

### Litters
```
GET  /admin/api/litters           → list all
GET  /admin/api/litters?id={id}   → single litter
POST /admin/api/litters           → create
POST /admin/api/litters?id={id}   → update
DELETE /admin/api/litters?id={id} → delete
```

**Litter object:**
```json
{
  "id": "litter-2026-a",
  "name": "Next Generation — Litter A",
  "sireId": "dog-harry",
  "damId": "dog-bella",
  "whelpDate": "2026-02-01",
  "status": "ACTIVE",
  "notes": ""
}
```

**Status values:** `COMING SOON` | `ACTIVE` | `CLOSED`

---

### Reservations
```
GET  /admin/api/reservations                  → list all (sorted newest first)
GET  /admin/api/reservations?id={ref}         → single reservation
POST /admin/api/reservations?id={ref}&action=update-status  → change status
POST /admin/api/reservations?id={ref}&action=add-note       → append note
POST /admin/api/reservations?id={ref}&action=delete         → delete
```

**Reservation object:**
```json
{
  "ref": "BG-2026-ABCD",
  "puppy": "puppy-leo",
  "name": "John Doe",
  "phone": "08012345678",
  "email": "john@example.com",
  "message": "",
  "ip": "197.210.xxx.xx",
  "status": "REQUESTED",
  "payment_url": null,
  "provider": "none",
  "provider_ref": null,
  "created_at": "2026-09-07T10:30:00Z",
  "hold_until": "2026-09-10T10:30:00Z",
  "paid_amount": null,
  "paid_currency": null,
  "paid_at": null,
  "notes": []
}
```

**Status transitions:** `REQUESTED` → `PAYMENT_PENDING` → `RESERVED` → `SOLD` → `CANCELLED`

---

### Testimonials
```
GET  /admin/api/testimonials              → list all
GET  /admin/api/testimonials?id={id}      → single
POST /admin/api/testimonials              → create
POST /admin/api/testimonials?id={id}      → update (toggle featured/approved)
DELETE /admin/api/testimonials?id={id}    → delete
```

**Testimonial object:**
```json
{
  "id": "testi-1725000004-g7h8",
  "name": "Adebayo O.",
  "rating": 5,
  "text": "Excellent breeder, very professional...",
  "source": "Google Review",
  "featured": false,
  "approved": true,
  "created_at": "2026-09-07T10:30:00Z"
}
```

---

### Gallery
```
GET  /admin/api/gallery              → list all
GET  /admin/api/gallery?id={id}      → single
POST /admin/api/gallery              → create
POST /admin/api/gallery?id={id}      → update
DELETE /admin/api/gallery?id={id}    → delete
```

**Gallery object:**
```json
{
  "id": "gal-1725000005-i9j0",
  "url": "https://cdn.example.com/photo.webp",
  "caption": "",
  "alt": "",
  "category": "dogs",
  "order": 0
}
```

---

### Settings
```
GET  /admin/api/settings      → get current settings
POST /admin/api/settings      → update settings
```

**Settings object:**
```json
{
  "whatsapp": "2348012345678",
  "email": "",
  "address": "",
  "instagram": "",
  "facebook": "",
  "aboutBlurb": "",
  "paymentProvider": "none",
  "currency": "NGN",
  "reservationAmount": 0,
  "holdHours": 72
}
```

---

## Deployment Checklist

1. Create Cloudflare Workers account
2. Run `wrangler login`
3. Set secrets:
   ```
   wrangler secret put ADMIN_PASSWORD
   wrangler secret put PAYSTACK_SECRET    (optional)
   wrangler secret put FLUTTERWAVE_SECRET (optional)
   wrangler secret put RECAPTCHA_SECRET   (optional)
   wrangler secret put NOTIFY_URL         (optional — webhook to Discord/Slack/email)
   ```
4. Create KV namespace and capture its ID
5. Update `wrangler.toml` with the KV namespace ID for both `RESERVATIONS` and `ADMIN`
6. Deploy:
   ```
   wrangler deploy
   ```
7. Set `window.BG_WEBHOOK_URL` in `reserve.html` and `contact.html` to the worker URL
8. Serve `admin.html` alongside the public site (same domain or subdomain)
9. Point public site to worker URL for webhook calls
