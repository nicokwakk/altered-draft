# Altered Draft Simulator

A browser-based multiplayer **draft + sealed** simulator for the [Altered TCG](https://altered.re). Players open the same URL from their own devices, draft or build pools together in real time, and export the result — copy a decklist for altered.re, or (optionally) save it straight to their **Re:Union** account.

**No backend to run.** It's a static SPA: shared room state lives in a single Supabase table and syncs over Supabase Realtime; the only server-side code is a couple of tiny Vercel serverless functions for the optional Re:Union login/decks integration. Live at **[altered-draft.vercel.app](https://altered-draft.vercel.app)**.

> New here as a player? Just open the live site and hit **Help** in the top bar — this README is for people running or contributing to the code.

---

## Features

- **Real-time draft** — open packs, pick a card, packs pass around the table (left on rounds 1 & 3, right on 2 & 4), 4 rounds.
- **Sealed** — each player opens a set of boosters and builds from their own pool.
- **Pool sources:** single-set **Presets**; **Multi-Set** (per-set pack counts, same packs for everyone or a shuffled bag); **Cubes** (built-in community cubes, paste-your-own, or loaded/merged from your Re:Union decks); custom card-pool paste.
- **Cube of the Month** spotlight, cube preview, and an in-app **hero draft** for hero-draft cubes.
- **Heroes** — one control: hero cards in the packs, or **free choice** of any hero from the full roster at deckbuild.
- **Deckbuilder + live stats** — faction split, set/type/rarity breakdown, mana curves, biome power totals; validity check (≥30 cards, ≤3 factions, ≤1 hero).
- **Export / Save** — copy a decklist in altered.re format, or save your pool + final deck to your **Re:Union** account (optional, opt-in).
- **Light / dark theme** mirroring [alteredcore.org](https://alteredcore.org); optional pick timer; per-room identity & decks persisted in `localStorage` for rejoin.

---

## Architecture

Frontend-only **React (Vite) + Tailwind**, with two small serverless pieces. Nothing here is a traditional backend.

**Shared state — no server.** A multiplayer room is one row in a single Supabase table:

```
draft_rooms ( id text pk, state jsonb, created_at timestamptz )
```

The entire game (config, players, packs, picks, phase…) is the `state` JSON. Clients subscribe via **Supabase Realtime** and write back with **optimistic concurrency** — a `version` field on the state guards against two players' picks clobbering each other. Per-room player identity and in-progress decks live in `localStorage` (so a refresh rejoins).

**Card data** is isolated in `src/lib/cardData.js`, sourced entirely from community/durable APIs (no dependency on the retiring official API):

- **Set card lists** → [`PolluxTroy0/Altered-TCG-Card-Database`](https://github.com/PolluxTroy0/Altered-TCG-Card-Database) (per-set JSON). Only the standard booster printing is kept; alt-art (`_A_`) / promo (`_P_`) reprints are canonicalised to it.
- **Uniques, promos, alt-art, non-EN** → [`cards.alteredcore.org`](https://cards.alteredcore.org) by reference (`needsCardApi()` decides what `fetchSet` can't supply).
- **Card art images** → the Altered prod S3 bucket (`altered-prod-eu`). _This is the one remaining dependency on Equinox infrastructure;_ `card-images-backup/` holds a local snapshot for the community cubes as a hedge.

**Cubes** live in `src/lib/cubes.js` (`COMMUNITY_CUBES` + a `SPOTLIGHT`). Users can also paste a decklist or load decks from Re:Union; both resolve through the shared `resolveCubeRefs` so they behave like a built-in cube.

**Re:Union integration (optional, opt-in)** — the only server-side code, two Vercel functions:

- `api/token.js` — OIDC **Authorization Code + PKCE** against Re:Union's **Keycloak** (confidential client `altered-draft`, realm `players`). It holds the client secret (env only) and does the code↔token exchange + refresh. **BFF-hardened:** the refresh token is stored in an **httpOnly, Secure, SameSite=Strict cookie** and never reaches JS; the browser keeps only the short-lived access token in memory.
- `api/decks/*` — a same-origin **proxy** to the Re:Union decks API (which sends no browser CORS), forwarding the user's bearer token to list/read/create decks.

Login is strictly additive: logged out, `user` is `null` and everything works anonymously.

**Layout:** `src/pages` (Home, Lobby, Draft, Sealed, Results, AuthCallback) · `src/components` · `src/lib` (game logic, card/cube data, Supabase/Re:Union clients) · `src/auth` (`AuthProvider`/`useAuth`) · `api/` (serverless functions). Theming is CSS-variable semantic tokens (`base`/`surface`/`ink`/`accent`…) flipped by `data-theme` — see `src/index.css` + `tailwind.config.js`.

---

## Running locally

```bash
npm install
cp .env.example .env    # fill in your Supabase keys (see below)
npm run dev             # http://localhost:5173
```

The core app (draft/sealed/cubes/export) runs with just Supabase. The Re:Union login/save features additionally need the serverless functions + Keycloak config (below); run them locally with `vercel dev` instead of `npm run dev`.

---

## Setting up Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL editor, run:

```sql
create table draft_rooms (
  id text primary key,
  state jsonb not null,
  created_at timestamptz default now()
);

-- Anonymous read/insert/update (the app has no Supabase-side auth)
alter table draft_rooms enable row level security;
create policy "anon read"   on draft_rooms for select using (true);
create policy "anon insert" on draft_rooms for insert with check (true);
create policy "anon update" on draft_rooms for update using (true);

-- Enable Realtime
alter publication supabase_realtime add table draft_rooms;
```

3. In **Project Settings → API**, copy the **Project URL** and the **publishable / anon** key into `.env`:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxx
```

> Only ever use the **publishable / anon** key in the frontend — it's safe to expose (RLS guards the table). The **secret** key must never be committed or placed in `.env`.

Optional: a `pg_cron` job can delete rooms older than 24h to keep the table tidy.

---

## Setting up Re:Union login (optional)

Skip this for a Supabase-only deployment — the app runs fully without it. To enable "Connect Re:Union" (load decks as cubes, save pool/deck):

1. Register a **Keycloak** OIDC client in the Re:Union `players` realm (confidential; the project uses client id `altered-draft`) with redirect URIs for your origin(s), e.g. `https://your-app.vercel.app/auth/callback` and `http://localhost:5173/auth/callback`.
2. Set the client secret as a **server-side env var only** — `KEYCLOAK_CLIENT_SECRET` in your Vercel project. **Never** put it in `.env`, the bundle, or git.
3. Public OIDC config (issuer, realm, client id) is inline in `api/token.js` / `src/lib/reunion.js` — adjust if your realm differs.

The decks API is reached through `api/decks/*` (same-origin proxy). No extra config needed beyond a logged-in user's token.

---

## Deploying to Vercel

1. Push to GitHub and import the repo at [vercel.com/new](https://vercel.com/new) (Vite is auto-detected).
2. Add env vars in the Vercel project: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and — for Re:Union — `KEYCLOAK_CLIENT_SECRET`.
3. Deploy. `vercel.json` handles SPA routing and keeps `/api/*` routed to the serverless functions.

---

## Sets

The UI shows set names; internal codes appear in card references (`ALT_<SET>_…`).

| Code | Name |
|------|------|
| `CORE` | Beyond the Gates |
| `ALIZE` | Trial by Frost |
| `BISE` | Whisper from the Maze |
| `CYCLONE` | Skybound Odyssey |
| `DUSTER` | Seeds of Unity |
| `EOLE` | Roots of Corruption |
| `FUGUE` | Neverending Journey |

## Booster composition

Each pack is **13 cards**: 1 Hero · 9 Commons (1 per faction + 3 paired-faction draws) · 3 Rares, where roughly 1 in 8 packs swaps its last Rare for a Unique. With free-hero choice the hero slot is dropped (12-card packs). Cube and Multi-Set modes follow the same per-booster shape.

---

## Tech

React (Vite) · Tailwind CSS · Supabase (Postgres + Realtime) · Vercel serverless functions · Keycloak OIDC (Re:Union). Contributions welcome — see the Architecture section for the lay of the land.

---

## License

The project's **source code** is released under the [MIT License](LICENSE).

This is an **unofficial, non-commercial fan project** and is not affiliated with or endorsed by the publisher of Altered TCG. The MIT license covers this repo's own code only — it does **not** cover any Altered TCG game assets (card images, card names/text, set and faction names, logos). Those belong to their respective owners (Equinox / the publisher) and are included here only as a community convenience; see the note at the bottom of [LICENSE](LICENSE). In particular the snapshots under `card-images-backup/` are Equinox-owned art, not MIT-licensed.
