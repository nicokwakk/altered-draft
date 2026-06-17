#!/usr/bin/env bash
# Snapshot card art for every community cube into card-images-backup/ as compressed
# WebP, so the cubes' images survive even if Equinox's S3 buckets ever go dark.
#
# BACKUP ONLY — not wired into the app (it still loads full-res from Equinox at
# runtime). This just preserves the images in version control.
#
# Source of truth: the refs in src/lib/cubes.js. For each ref we ask the community
# cards API for its English image path, normalise it to the public prod bucket, and
# pull a resized WebP through the free images.weserv.nl proxy (no local image tools
# needed). Resumable: already-downloaded files are skipped, so re-run to fill gaps.
set -u
cd "$(dirname "$0")/.."
OUT="card-images-backup"
UA="Mozilla/5.0"
WIDTH=720
Q=80
mkdir -p "$OUT"

fetch_one() {
  local ref="$1" out="$OUT/$1.webp"
  [ -s "$out" ] && { echo "skip  $ref"; return 0; }
  local json path prod
  json=$(curl -s -A "$UA" "https://cards.alteredcore.org/api/cards?reference=$ref" | sed 's/\\//g')
  path=$(echo "$json" | grep -oE '(https?://[^"]+/)?Art/[^"]*en_US[^"]*\.jpg' | head -1)
  [ -z "$path" ] && { echo "MISS  $ref (no image)"; return 1; }
  prod="altered-prod-eu.s3.amazonaws.com/$(echo "$path" | sed -E 's#^https?://[^/]+/##')"
  curl -s -A "$UA" --max-time 30 -o "$out" "https://images.weserv.nl/?url=$prod&w=$WIDTH&q=$Q&output=webp"
  if [ -s "$out" ]; then echo "ok    $ref"; else echo "FAIL  $ref"; rm -f "$out"; return 1; fi
}
export -f fetch_one
export OUT UA WIDTH Q

refs=$(grep -oE 'ALT_[A-Z0-9_]+' src/lib/cubes.js | sort -u)
total=$(echo "$refs" | wc -l)
echo "Snapshotting $total cube card images -> $OUT/ (${WIDTH}px webp q${Q})"
echo "$refs" | xargs -P 6 -I {} bash -c 'fetch_one "$@"' _ {}
echo "Done. $(ls "$OUT" 2>/dev/null | wc -l)/$total saved, $(du -sh "$OUT" 2>/dev/null | cut -f1) total."
