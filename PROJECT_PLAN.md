# Bellissimo Geni Cane Corso — Project Plan

> **IMPL STATUS (BASELINE):** Phase 1–6 implemented (home, dogs, pedigree, puppies, reservation). Phase 7 (payment) shipped as a real deployable serverless handler in `webhook/` (validation, reCAPTCHA, idempotency, Paystack/Flutterwave adapters, signature verification, status transitions) — live initiation still gated on client confirmation (provider, deposit rules, refunds, currency). Phase 8 content pages built with TBC placeholders needing client data (about, standards/health, socialization, testimonials, social). Phase 9–10 partially done (a11y, SEO, sitemap, robots, lazy loading, anti-spam honeypot, reCAPTCHA scaffold); final QA awaiting client data. **Blocked:** payment provider & rules; real dog/pedigree/photos/prices; contact & social details; approved testimonials/health claims; brand logo/media swap (no viewer-verified image assets).

## Project goal
Build a premium, responsive Bellissimo Geni Cane Corso website inspired by the information depth and kennel presentation of the client's reference site, while using original Bellissimo Geni branding, content, photography and implementation.

The website is a lead-generation and trust platform with five core experiences:

1. Discover Bellissimo Geni and its dogs.
2. Explore real puppies and litters.
3. Search and navigate multi-generation dog pedigrees.
4. Reserve a puppy and, once payment rules/provider are confirmed, pay a reservation amount securely.
5. Give the kennel owner a secure, easy-to-use private admin area for managing dogs, pedigrees, puppies, photos, litters, reservations and site content without editing code.

## Client requirements captured from voice notes

### Reference website
- Homepage and overall information depth should be comparable to the reference website supplied by the client.
- Do not copy the reference site's branding, text, images, code or exact visual design.

### Pedigree
- Create a dedicated **Pedigree** section.
- Provide a dog search function.
- Searching a dog such as `Henry` should return Henry's photograph/profile.
- Henry's profile must show **Sire** (father) and **Dam** (mother).
- Sire and Dam names must be clickable.
- Clicking a parent opens that parent's profile.
- The parent's profile must show its own parents, allowing ancestry to be followed recursively.
- Architecture must support **five to seven generations**.
- The client will provide the photographs needed for dogs and ancestors.

### Puppies
- Include puppy reservation functionality.
- Reservation should be connected to payment rather than being enquiry-only.

## Owner Admin / Content Management System

The public website must be backed by a **secure private owner administration area** so the kennel owner can maintain the website without editing HTML, JavaScript, JSON or GitHub files.

### Admin access
- Private `/admin` application or equivalent protected admin route.
- Secure authentication with strong password requirements and session/token protection.
- Owner-only access by default; do not expose management functions to public visitors.
- No GitHub credentials or payment credentials stored in the browser.
- Server-side authorization for every administrative operation.
- Logout/session expiry and protection against unauthorized access.
- Do not store raw card/payment credentials.
- Provide an audit trail for important changes where practical.

### Admin dashboard
The dashboard should provide clear sections for:

- Dashboard / overview
- Dogs
- Pedigrees / bloodlines
- Puppies
- Litters
- Reservations
- Gallery / media
- Testimonials
- Site content
- Contact/social settings
- Payment/reservation settings
- Account/security settings

### Dog management
Owner should be able to:
- Add a dog.
- Edit a dog.
- Archive/unpublish a dog without deleting historical relationships.
- Upload and replace the main dog photograph.
- Upload multiple gallery photographs.
- Set name, sex, date of birth, colour and registration details.
- Set status.
- Add approved biography, bloodline and achievement information.
- Add substantiated health/testing information.
- Select the dog's Sire and Dam from existing records.
- Create a new parent record when required.
- Preview the public profile before publishing.
- Publish/unpublish changes.

### Pedigree management
The admin interface should make pedigree maintenance visual and simple:

```text
Create/Edit Dog
   -> Select Sire
   -> Select Dam
   -> Save
   -> Pedigree engine automatically traverses ancestry
```

Requirements:
- Stable dog IDs.
- Sire/Dam relationships stored by ID, never by fragile display-name matching.
- Support at least seven generations.
- Search existing dogs while selecting parents.
- Show the resulting ancestry tree before publishing.
- Detect circular references.
- Avoid duplicate/conflicting records where possible.
- Clearly distinguish unknown/missing ancestry from verified ancestry.
- Never invent pedigree information.

### Puppy and litter management
Owner should be able to:
- Create a litter.
- Link litter Sire and Dam.
- Add puppies individually.
- Upload puppy photographs.
- Set sex, colour, date of birth, registration and other approved details.
- Set price or enquiry-only pricing.
- Set availability date.
- Change status between AVAILABLE, PAYMENT PENDING, RESERVED, SOLD, COMING SOON and UNAVAILABLE.
- Publish/unpublish a puppy.
- See which puppy is linked to each reservation.
- Prevent accidental deletion of puppies with historical reservations.

### Media management
The owner should not need to edit code to change imagery.

Admin media features:
- Upload dog photos.
- Upload puppy photos.
- Upload litter photos.
- Upload kennel/facility photos.
- Upload gallery images.
- Add captions/alt text.
- Reorder gallery images.
- Replace images without breaking public URLs where practical.
- Automatically create optimized web formats/sizes where practical.
- Validate supported file types and file sizes.
- Keep originals/private uploads protected where appropriate.

### Reservations and payments
The admin area should show:
- New reservations.
- Customer details required for the reservation process.
- Puppy reserved.
- Reservation reference.
- Payment status.
- Reservation status.
- Date/time.
- Provider transaction reference where applicable.
- Notes/actions for the kennel owner.

Owner actions must respect the reservation/payment state machine. Manual overrides should require appropriate authorization and should be auditable.

Recommended flow:

```text
Public Puppy Profile
  -> Reserve
  -> Reservation Form
  -> Summary
  -> Payment
  -> Verified Payment/Webhook
  -> Reservation Confirmed
  -> Owner sees confirmed reservation in Admin
```

### Site content management
Where practical, owner-editable content should include:
- About/kennel story.
- Breeding philosophy.
- Standards and care information.
- Health/testing information.
- Socialization program.
- Contact details.
- WhatsApp number.
- Email.
- Address/location text.
- Opening/contact hours.
- Social-media links.
- Testimonials.
- Homepage featured content.

Sensitive technical settings, secrets, API keys and payment-provider credentials must remain server-side and must never be editable as plain frontend content.

### Admin UX requirements
The admin should be:
- Mobile-friendly so the owner can manage the kennel from a phone.
- Fast and simple enough for non-technical use.
- Consistent with the premium Bellissimo Geni brand without sacrificing usability.
- Built around forms, search, filters, previews and clear save/publish states.
- Explicit about destructive actions.
- Able to show success/error feedback.
- Designed so an owner can add a dog and its pedigree/photo without developer assistance.

## Recommended product architecture

### Primary navigation
- Home
- About
- Our Dogs
- Puppies
- Pedigree
- Breeding
- Gallery
- Testimonials
- Contact / Apply

### Dog profile
Each dog should have a unique stable ID and, where supplied:
- Name
- Sex
- Date of birth
- Colour
- Main photograph and gallery
- Registration information
- Status
- Sire ID
- Dam ID
- Bloodline/pedigree information
- Health/testing information that the client can substantiate
- Achievements/notes where applicable

### Pedigree engine
Use relationships rather than hard-coded ancestry pages:

```text
Dog
├── sire_id -> Dog
└── dam_id  -> Dog
```

The UI should traverse those relationships recursively. Design the data model for at least seven generations from day one.

Desktop: visual family tree / connected cards.
Mobile: readable stacked or expandable generation cards with clear parent navigation.

Core pedigree flow:

```text
Search dog
  -> Dog profile
  -> Sire / Dam
  -> Parent profile
  -> Grandparents
  -> Continue through ancestry
  -> Up to 7 generations where data exists
```

Missing ancestry must be represented honestly; never invent parent data.

### Puppy/litter system
Puppies should be linked to their litter and parents. Recommended states:
- AVAILABLE
- PAYMENT PENDING
- RESERVED
- SOLD
- COMING SOON
- UNAVAILABLE

A puppy record should be able to reference:
- Litter
- Sire
- Dam
- Photos/videos
- Sex
- Colour
- Date of birth
- Registration information
- Price or enquiry pricing
- Availability status

### Reservation and payment
Recommended flow:

```text
Puppy
  -> Reserve this puppy
  -> Reservation form
  -> Reservation summary
  -> Payment
  -> Verified payment
  -> Reservation confirmed
```

A reservation should have its own reference and status and be tied to a specific puppy.

Do not store card details on the Bellissimo Geni website. A supported payment provider should process sensitive payment information. Provider selection, deposit amount, refund policy, cancellation policy and balance-payment rules require client confirmation before production payment logic is finalized.

## Proposed homepage

1. Premium hero with real Bellissimo Geni logo, client photography and **Est. 2023**.
2. Brand introduction / story.
3. Featured dogs.
4. Available puppies.
5. **Know Their Lineage** / Pedigree feature with search CTA.
6. Breeding philosophy and standards.
7. Featured bloodlines / parent dogs.
8. Gallery.
9. Testimonials.
10. Social media hub.
11. Puppy reservation CTA.
12. Contact / application.

## Content and media requirements
Client supplies:
- Logo
- Dog photographs
- Ancestor photographs where available
- Puppy photographs
- Litter photographs
- Kennel photographs
- Other approved brand/social media assets
- Dog and pedigree facts
- Real puppy availability/pricing
- Contact details
- Social links
- Breeding and health information that is approved for publication

No demo puppy names, prices, pedigree claims or unsupported health claims should remain in production.

## Technical direction

Current project is dependency-free HTML/CSS/JavaScript and GitHub Pages compatible. Keep the front end lightweight, but introduce a structured backend/database, authentication, media storage and serverless/API layer when the owner CMS and transactional features are implemented.

Recommended production architecture:

```text
Public Website
      |
      v
Secure API / Serverless Backend
      |
      +---- Database (dogs, pedigrees, puppies, litters, reservations, content)
      |
      +---- Media Storage (photos/gallery)
      |
      +---- Payment Provider
      |
      +---- Email/notification service
      |
      v
Private Owner Admin
```

Priorities:
- Mobile-first responsive UI
- Accessible navigation and forms
- Fast image delivery (WebP/AVIF where practical)
- Lazy loading for non-critical media
- Minimal JavaScript
- Semantic HTML
- SEO metadata and structured data
- Sitemap and robots.txt
- Open Graph/social sharing
- Secure server-side validation for transactional features
- Secure authentication and authorization for admin
- Payment webhook verification
- No secrets in frontend code
- Audit logging for sensitive admin/payment operations where practical
- Analytics for puppy views, applications, reservations and WhatsApp/contact clicks

## Development phases

### Phase 0 — Discovery
- Confirm all voice-note requirements
- Collect logo and media
- Collect dog/pedigree records
- Confirm payment provider and reservation rules
- Confirm contact/social details

### Phase 1 — Brand and foundation
- Design tokens
- Typography
- Real logo
- Global navigation
- Responsive shell
- Reusable cards/components

### Phase 2 — Homepage
- Premium hero
- Story
- Featured dogs
- Puppies
- Pedigree CTA
- Standards
- Social/gallery/contact

### Phase 3 — Dogs
- Dog data model
- Male/female listings
- Individual profiles
- Dog search

### Phase 4 — Pedigree engine
- Pedigree search
- Parent relationships
- Clickable parent profiles
- Five-generation support
- Seven-generation support
- Desktop tree
- Mobile generation interface

### Phase 5 — Puppies
- Puppy data model
- Available puppies
- Upcoming litters
- Individual puppy pages
- Status management

### Phase 6 — Reservation
- Reserve flow
- Customer information
- Reservation record
- Reservation reference
- Terms acceptance
- Confirmation

### Phase 7 — Payment
- Payment provider integration
- Payment initiation
- Secure verification
- Webhooks
- Payment states
- Reservation state transitions
- Notifications

### Phase 8 — Owner Admin / CMS
- Secure owner authentication
- Protected admin route/application
- Dashboard
- Dog CRUD and publishing
- Dog photo/media uploads
- Sire/Dam relationship editor
- Seven-generation pedigree management
- Circular-reference and data-integrity validation
- Puppy/litter management
- Availability/status management
- Gallery/media management
- Testimonials/content management
- Contact/social/settings management
- Reservation/payment dashboard
- Audit trail for important administrative changes
- Mobile-friendly admin UX
- Preview-before-publish workflow where practical

### Phase 9 — Content
- About
- Breeding program
- Standards
- Health/testing
- Socialization
- Gallery
- Testimonials
- Social links
- Migrate approved existing demo/TBC content into owner-managed records

### Phase 10 — SEO/performance/accessibility
- Metadata
- Structured data
- Sitemap/robots
- Image optimization
- Accessibility audit
- Responsive QA
- Performance audit
- Admin accessibility/usability audit

### Phase 11 — Security and launch
- Form hardening
- Spam protection
- Authentication/authorization review
- Media upload security review
- Payment security review
- Backup/access review
- Data recovery strategy
- Production deployment
- Final client acceptance

## GitHub implementation commits

1. `docs: add client requirements and implementation plan`
2. `feat: establish Bellissimo Geni brand and responsive site foundation`
3. `feat: build premium homepage experience`
4. `feat: add dog data architecture and profiles`
5. `feat: add dog search`
6. `feat: add pedigree data model`
7. `feat: build multi-generation pedigree explorer`
8. `feat: add puppy and litter architecture`
9. `feat: build puppy reservation flow`
10. `feat: integrate secure reservation payments`
11. `feat: add breeding, gallery and social content`
12. `feat: harden SEO accessibility performance and forms`
13. `feat: build secure owner admin CMS`
14. `feat: connect admin CMS to dogs pedigrees puppies litters and media`
15. `feat: connect admin CMS to reservations and payments`
16. `test: complete responsive and production QA`
17. `chore: prepare production launch`

## Client decisions required before transactional launch

- Payment provider
- Reservation/deposit amount
- Full payment vs deposit-only
- Refund policy
- Cancellation policy
- Balance-payment timing
- Delivery/shipping rules
- Countries/payment currencies supported
- Final puppy prices
- Final dog/pedigree records
- Final contact and social links
- Admin owner account/contact for secure account setup (never request or commit the owner's password)

## Scope principle

The pedigree database, owner CMS and reservation/payment workflow are major product features, not cosmetic additions. They should be architected deliberately rather than bolted onto the static homepage later. The kennel owner must ultimately be able to maintain core business content and dog/pedigree/media records independently, while transactional and security-sensitive operations remain protected by the backend.
