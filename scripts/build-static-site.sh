#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="${1:-dist}"

mkdir -p assets/dogs assets/puppies

# Reconstruct deployment-only HD photos from repository-safe chunks.
cat .github/assets/family-dog1.b64.part* | tr -d '\n\r' | base64 --decode > assets/dogs/bellissimo-family-dog-01.webp
cat .github/assets/family-dog2.b64.part* | tr -d '\n\r' | base64 --decode > assets/dogs/bellissimo-family-dog-02.webp
cat .github/assets/featured-black-corso.b64.part* | tr -d '\n\r' | base64 --decode > assets/dogs/bellissimo-featured-black-corso.webp
cat .github/assets/puppy-section.b64.part* | tr -d '\n\r' | base64 --decode > assets/dogs/bellissimo-puppy-section.webp
cat .github/assets/rocco-bellissimo-geni-avif.b64.part* | tr -d '\n\r' | base64 --decode > assets/dogs/himera-custodi-nos-main.avif
cat .github/assets/diesel-bellissimo-geni-avif.b64.part* | tr -d '\n\r' | base64 --decode > assets/dogs/himera-custodi-nos-02.avif

test -s assets/dogs/bellissimo-family-dog-01.webp
test -s assets/dogs/bellissimo-family-dog-02.webp
test -s assets/dogs/bellissimo-featured-black-corso.webp
test -s assets/dogs/bellissimo-puppy-section.webp
test -s assets/dogs/himera-custodi-nos-main.avif
test -s assets/dogs/himera-custodi-nos-02.avif
test -s assets/puppies/x-bellissimo-geni-main.avif
test -s assets/puppies/x-bellissimo-geni-standing.avif

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

tar -C . \
  --exclude="./$OUT_DIR" \
  --exclude='./build' \
  --exclude='./dist' \
  --exclude='./.git' \
  --exclude='./.github' \
  --exclude='./webhook' \
  --exclude='./scripts' \
  --exclude='./node_modules' \
  --exclude='./wrangler.toml' \
  --exclude='./package.json' \
  --exclude='./package-lock.json' \
  -cf - . | tar -C "$OUT_DIR" -xf -

touch "$OUT_DIR/.nojekyll"

test -f "$OUT_DIR/index.html"
test -f "$OUT_DIR/admin.html"
test -f "$OUT_DIR/site-config.json"
test -f "$OUT_DIR/_headers"
test -f "$OUT_DIR/_redirects"

echo "Static site prepared in $OUT_DIR"
