# Bellissimo Geni Cane Corso — Project Plan

## Project goal
Build a premium, responsive Bellissimo Geni Cane Corso website inspired by the information depth and kennel presentation of the client's reference site, while using original Bellissimo Geni branding, content, photography and implementation.

The website is a lead-generation and trust platform with four core experiences:

1. Discover Bellissimo Geni and its dogs.
2. Explore real puppies and litters.
3. Search and navigate multi-generation dog pedigrees.
4. Reserve a puppy and, once payment rules/provider are confirmed, pay a reservation amount securely.

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

Current project is dependency-free HTML/CSS/JavaScript and GitHub Pages compatible. Keep the front end lightweight, but introduce structured data and a small backend/serverless layer when reservations/payment require persistence and secure payment verification.

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
- Payment webhook verification
- No secrets in frontend code
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

### Phase 8 — Content
- About
- Breeding program
- Standards
- Health/testing
- Socialization
- Gallery
- Testimonials
- Social links

### Phase 9 — SEO/performance/accessibility
- Metadata
- Structured data
- Sitemap/robots
- Image optimization
- Accessibility audit
- Responsive QA
- Performance audit

### Phase 10 — Security and launch
- Form hardening
- Spam protection
- Payment security review
- Backup/access review
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
13. `test: complete responsive and production QA`
14. `chore: prepare production launch`

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

## Scope principle

The pedigree database and reservation/payment workflow are major product features, not cosmetic additions. They should be architected deliberately rather than bolted onto the static homepage later.
