# Community-cube card image backup

Compressed WebP (≈720px) snapshots of the art for every card in `COMMUNITY_CUBES`
(`src/lib/cubes.js`) — heroes, commons, uniques and promos included.

**Why:** card *data* is durable (community `cards.alteredcore.org`), but card *art*
still loads from Equinox's S3 buckets (`altered-prod-eu` / `altered-dev`), which aren't
guaranteed to outlive the game. This folder preserves the images so the cubes can still
be rendered if those buckets ever go dark.

**Status:** BACKUP ONLY — the app still loads full-res art from Equinox at runtime; this
is not wired into a fallback. To refresh/extend after editing the cubes, re-run
(resumable, skips existing):

    bash scripts/snapshot-cube-images.sh

Filenames are `<CARD_REFERENCE>.webp` (English art).
