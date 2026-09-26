# Bellissimo Geni Fast Change Skill

Use this workflow for small website updates such as changing a dog photo, correcting dog details, adding one gallery image, fixing a label, or making a similarly narrow content/UI change.

## Goal

Finish simple changes quickly, accurately, and with minimal code churn. Preserve image clarity and the existing site structure.

## Fast path

1. Read the user's latest instruction and the directly relevant supplied media/messages.
2. Identify the exact existing record/page/component that needs changing.
3. Make only the changes required for that request. Do not start a broad redesign, architecture audit, admin rewrite, or unrelated cleanup unless it is necessary to make the requested change work.
4. For dog/puppy photos:
   - Use the exact supplied photo assigned by the user.
   - Preserve the original source resolution and aspect ratio.
   - Never upscale a lower-resolution source and call it HD.
   - Do not crop off the dog's face, ears, paws, or body unless the user explicitly asks for a crop.
   - Prefer `object-fit: contain` for profile/main images when cropping would hide the dog.
   - Keep the highest-quality supplied source; do not repeatedly recompress it.
   - Main photo and gallery photos must not duplicate each other.
5. For dog/puppy details, copy verified values exactly from the supplied message/record. Never guess names, colour, DOB, sex, sire, dam, status, or ownership.
6. Keep existing unrelated records and featured/banner images unchanged unless the user explicitly asks to replace them.
7. Run only targeted checks for the files/feature changed. Confirm:
   - image loads;
   - main image is the intended image;
   - gallery image(s) are distinct and open correctly;
   - text/details match the supplied source;
   - mobile and desktop do not crop the subject incorrectly;
   - no unrelated content changed.
8. Commit the smallest working change and merge it once verified.

## Scope control

For a simple photo/details request, do not:
- benchmark the entire site;
- refactor unrelated code;
- create a new design system;
- touch deployment/backend/admin code unless the requested change actually depends on it;
- run the full test suite when a focused regression check is enough;
- delay implementation for speculative improvements.

If a broader issue is noticed, leave it for a separate task unless it blocks the requested change.

## Bellissimo Geni image standard

A photo is acceptable when it is the correct dog, sharp at the supplied source resolution, naturally framed, not stretched, not duplicated unnecessarily, and displayed without cutting important parts of the dog. Accuracy takes priority over decorative effects.
