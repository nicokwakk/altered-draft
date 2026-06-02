# Altered Draft Simulator

A browser-based multiplayer **draft + sealed** simulator for the [Altered TCG](https://altered.re). Players open the same URL from their own devices, draft or build pools together in real time, and export their final decklist in a format that pastes directly into the altered.re deckbuilder.

No backend to run — state lives in a single Supabase table and syncs over Supabase Realtime. Live at **[altered-draft.vercel.app](https://altered-draft.vercel.app)**.

---

## Features

- **Real-time draft** — open packs, pick a card, packs pass around the table (left on rounds 1 & 3, right on rounds 2 & 4), 4 rounds.
- **Sealed** — each player gets 7 boosters and builds from their own pool.
- **Game modes / pool sources:**
  - **Presets** — 4 packs (draft) or 7 boosters (sealed) of a single set.
  - **Advanced** — pick multiple sets with per-set pack counts, or paste a **custom card pool**.
  - **Cubes** — curated community card pools.
  - **Chaos draft** — fill a bag with any mix of single-set boosters (counts need not be a multiple of the player count); all boosters are shuffled and dealt at random.
- **Optional pick timer** with auto-pick on timeout.
- **Deckbuilder + live stats** — faction split, set/type/rarity breakdown, mana curves, biome power totals. Validity check (≥30 cards, ≤3 factions, ≤1 hero).
- **Export** to the altered.re decklist format.
- Identity and decks persist in `localStorage`, so a refresh or accidental close lets you rejoin.

---

## Running locally

```bash
npm install
cp .env.example .env    # then fill in your Supabase keys (see below)
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Setting up Supabase

1. Go to [supabase.com](https://supabase.com) and create a free project.
2. In the SQL editor, run:

```sql
create table draft_rooms (
  id text primary key,
  state jsonb not null,
  created_at timestamptz default now()
);

-- Allow anonymous read/insert/update (no auth in this app)
alter table draft_rooms enable row level security;
create policy "anon read"   on draft_rooms for select using (true);
create policy "anon insert" on draft_rooms for insert with check (true);
create policy "anon update" on draft_rooms for update using (true);

-- Enable Realtime for the table
alter publication supabase_realtime add table draft_rooms;
```

3. In **Project Settings → API**, copy your **Project URL** and the **publishable / anon** key.
4. Paste them into `.env`:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxx
```

> Only ever use the **publishable / anon** key in the frontend. The secret key must never be committed or placed in `.env`.

Optional: a scheduled job (e.g. `pg_cron`) can delete rooms older than 24h to keep the table clean.

---

## Deploying to Vercel

1. Push this repo to GitHub.
2. Import the repo in [vercel.com](https://vercel.com/new).
3. Add the two environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in the Vercel project settings.
4. Deploy — Vercel detects Vite automatically.

The included `vercel.json` handles client-side routing so direct URL access works correctly.

---

## How to use

1. The **host** clicks **"Create a room"** and enters a display name.
2. A 4-character room code (and shareable link / QR) is displayed — share it.
3. **Other players** click **"Join a room"**, enter the code and their name.
4. The **host** picks **Draft** or **Sealed**, a mode tab (Presets / Cubes / Advanced / Chaos), language, hero/timer options, then starts. (Sealed can be started solo; draft needs at least 2 players.)
5. **Draft:** click a card in your pack to draft it; the pack passes automatically. **Sealed:** open your 7 boosters and add cards to your deck.
6. Build your deck and review stats as you go.
7. Click **Export**, then paste into [altered.re/pages/decks](https://altered.re/pages/decks).

---

## Sets

The UI shows set names; internal codes are used in card references (`ALT_<SET>_…`).

| Code | Name |
|------|------|
| `CORE` | Beyond the Gates |
| `ALIZE` | Trial by Frost |
| `BISE` | Whisper from the Maze |
| `CYCLONE` | Skybound Odyssey |
| `DUSTER` | Seeds of Unity |
| `EOLE` | Roots of Corruption |
| `FUGUE` | Neverending Journey |

Card data is fetched at runtime from the community [Altered-TCG-Card-Database](https://github.com/PolluxTroy0/Altered-TCG-Card-Database). Only the standard booster printing of each card is used — alternate-art (`_A_`) and promo (`_P_`) reprints are filtered out so each card has one canonical version.

---

## Booster composition

Each pack is **13 cards**: 1 Hero · 9 Commons (1 per faction + 3 paired faction draws) · 3 Rares, where roughly 1 in 8 packs swaps its last Rare for a Unique. Heroes can be toggled off (12-card packs). Cube and Chaos modes follow the same shape per booster.

---

## Tech

React (Vite) · Tailwind CSS · Supabase (Postgres + Realtime) · deployed on Vercel. Picks use optimistic concurrency (a `version` field on the room state) so simultaneous picks from different players never clobber each other.
