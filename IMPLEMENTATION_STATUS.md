# Bellissimo Geni — Implementation Status

**Authoritative status date:** 26 September 2026

Use this file instead of old chat instructions when deciding what still needs work. Later verified instructions supersede earlier conflicting ones.

## Done

- ALLEVAMENTO BELLISSIMO GENI branding and current homepage visual baseline
- mobile quick navigation: Our Dogs → Puppies → Menu
- verified current dogs and Past Productions currently present in `data/dogs.json`
- Anthie Custodi Nos correction
- latest supplied photography for Anthie, Roman Custodi Nos, Birba Sangue Magnifica, ZZ Top Sangue Magnifica and Limoncello Sangue Magnifica Custodi Nos
- Yasmin is classified under Past Productions with verified Branco × Anthie parentage
- Diesel and Rocco are recorded as Branco × Tessa Past Productions from their supplied CCKC pedigrees
- Himera and Nefertiti health rows include the supplied ED0 details; Himera also records OCD free
- Branco uses the requested former photograph as his published main image
- explicit parent/offspring relationship context on dog profiles and pedigree cards
- owner display for current kennel dogs
- direct dog profiles and sire/dam navigation
- multi-generation pedigree traversal
- dog/photo anti-cropping treatment
- verified Instagram, TikTok and Facebook links
- verified phone: **+234 913 780 6866**
- verified email: **Bellissimogenicanecorso@gmail.com**
- verified direct WhatsApp link: **https://wa.me/message/YSFP25LSDD7AP1**
- contact and reservation enquiry routes use the verified WhatsApp number
- six late kennel-supplied puppy/young-dog photos are published as a photography gallery only
- the late photos do **not** create or imply available puppy listings
- GitHub Pages deployment and automated desktop/mobile screenshot coverage

## Waiting for verified kennel information

Only add puppy listings when the kennel supplies the facts for each puppy:
- name or stable identifier
- sex
- date of birth / litter
- sire and dam
- colour
- current availability status
- whether the photo is listing media or gallery-only media

Do not infer these from photographs.

## External production setup still required

The admin/Worker code exists, but Cloudflare resources must be created in the kennel's Cloudflare account:
- ADMIN KV namespace
- RESERVATIONS KV namespace
- R2 media bucket
- ADMIN_PASSWORD Worker secret
- deployed Worker URL

These values must not be invented or committed as secrets.

## Payment remains intentionally disabled

Do not enable payment until the kennel approves:
- payment provider
- deposit amount
- refund policy
- cancellation policy
- reservation hold duration
- balance-payment timing

Until then, the safe production behaviour is enquiry/reservation-request only.

## Release rule

A change is ready for `main` only when the focused GitHub screenshot/smoke workflow passes and no newer verified instruction contradicts it.
