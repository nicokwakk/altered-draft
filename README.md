# Altered Draft Simulator

A browser-based multiplayer booster draft simulator for the [Altered TCG](https://altered.re). Players open the same URL from their laptops, draft cards together in real time by passing packs, and export their final decklist in a format that can be pasted directly into the altered.re deckbuilder.

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

-- Enable Realtime for the table
alter publication supabase_realtime add table draft_rooms;
```

3. In **Project Settings → API**, copy your **Project URL** and **anon public** key.
4. Paste them into `.env`:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

---

## Deploying to Vercel

1. Push this repo to GitHub.
2. Import the repo in [vercel.com](https://vercel.com/new).
3. Add the two environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in the Vercel project settings.
4. Deploy — Vercel detects Vite automatically.

The included `vercel.json` handles client-side routing so direct URL access works correctly.

---

## How to use

1. **Host** opens the app and clicks **"Create a room"**.
2. A 4-letter room code is displayed — share it with other players.
3. **Other players** click **"Join a room"**, enter the code and their name.
4. Once everyone has joined, the **host** selects sets, language, and clicks **"Start draft"**.
5. Each player sees their pack. Click a card to draft it. The pack automatically passes to the next player.
6. After all 4 rounds, the **Results** page appears.
7. Click **"Copy decklist for altered.re"**, then go to [altered.re/pages/decks](https://altered.re/pages/decks) and paste.

---

## Available sets

| Code | Name |
|------|------|
| `CORE` | Beyond the Gates |
| `ALIZE` | Trial By Frost |
| `BISE` | Whisper From The Maze |
| `CYCLONE` | Skybound Odyssey |
| `DUSTER` | Seeds of Unity |
| `EOLE` | Roots of Corruption / Neverending Journey |

---

## Booster composition

Each pack (12 cards): 1 Hero · 8 Commons (1 per faction + 3 paired faction draws) · 3 Rares (1-in-8 packs has one Rare replaced by a Unique).
