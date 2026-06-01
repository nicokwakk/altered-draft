# Altered Draft Simulator — Project Memory

Multiplayer booster-draft + sealed simulator for the Altered TCG. React (Vite) + Tailwind + Supabase Realtime. No backend. Deployed on Vercel at https://altered-draft.vercel.app

## Environment / workflow
- Node is NOT on PATH; cannot run `npm`/build locally. Verify changes by reasoning + pushing to Vercel (auto-deploys on push to `main`).
- Use **PowerShell** tool for git (bash has no `npm`). `git push 2>&1` prints to stderr and shows a red error wrapper even on success — that's normal, check the last line for `main -> main`.
- Commit + push after each change so Vercel redeploys. Repo: github.com/nicokwakk/altered-draft. Commit author already configured.
- GitHub blocks pushes exposing the private email — user's noreply email is already set in repo config.

## Card data
- Source: `https://raw.githubusercontent.com/PolluxTroy0/Altered-TCG-Card-Database/main/SETS/{SET}/{SET}_{LANG}.json`
- Root is a **plain array** (NOT `hydra:member`).
- Key per-card fields (see `src/lib/cardData.js` `normalizeCard`):
  - `mainFaction.reference` → faction (AX/BR/LY/MU/OR/YZ)
  - `rarity.reference`: verbose strings → normalized codes: COMMON→`C`, RARE→`R1`/`R2` (R2 if ref ends `_R2`), UNIQUE→`U`, EXALTED→`EX` (also `_E` ref suffix). EX treated as rare in packs.
  - `cardType.reference`: HERO / CHARACTER / SPELL / LANDMARK_PERMANENT / EXPEDITION_PERMANENT / PERMANENT / TOKEN. TOKENs excluded from draft.
  - `imagePath` is already a full URL (no prefix needed).
  - `elements.MAIN_COST` etc. are wrapped in `#...#` markers — `stripMarkers()` removes them. Heroes have mainCost 0 (ignore for cost curves).
- `COREKS` (Kickstarter) has its own dataset; `apiSetCode()` is identity (do NOT remap to CORE).

## Sets (`SETS` in cardData.js)
CORE=Beyond the Gates(BTG), COREKS=BTG KS (hidden:true, not a preset), ALIZE=Trial by Frost(TBF), BISE=Whisper from the Maze(WTM), CYCLONE=Skybound Odyssey(SKY), DUSTER=Seeds of Unity(SDU), EOLE=Roots of Corruption(ROC), FUGUE=Neverending Journey(NEJ). Internal codes hidden from UI; show names/abbreviations. See `SET_ABBREV`, `SET_FULL_NAMES`, `SET_ABBREV_ICON_CODE`.

## Assets (`src/lib/assets.js`)
Faction icons, rarity gems, set icons/logos all from `https://cdn.alteredcore.org/marketing/...`. No FUGUE logo or Exalted gem available yet (EX reuses rare gem; FUGUE/CORE fall back to text). `setCodeFromRef(ref)` = `ref.split('_')[1]`.

## Booster composition (`src/lib/packGenerator.js`)
13 cards: 1 hero + 9 commons (1 per faction + 3 paired draws AX|BR, LY|MU, OR|YZ) + 3 rares (1-in-8 packs swaps last rare for a unique). `generateAllPacks(cards, players, packsPerPlayer, {includeHeroes, cubeMode})`. Cube mode deals each card at most once across ALL packs (no repeats); uniques only in last slot. Pools deduplicated by `name+faction`. `splitPools()` helper shared by all generators.
**Chaos draft** (`generateChaosPacks(cardsBySet, packMix, {includeHeroes})`): each booster is a single-set pack (normal composition). Host picks any number of boosters per set (NOT a multiple of player count); total must equal players×4. All boosters shuffled together → flat array → `buildInitialState` deals one random pack per seat per round. Draft only. Config tab `chaos` (hidden in sealed). Stored as `config.chaosMix`. UI: `ChaosSelector.jsx`.

## Draft logic (`src/lib/draftLogic.js`)
Pure transitions. `applyPick(state, idx, ref)`. Pass left rounds 1&3, right 2&4. `pickDeadline` (timer) format is `"<ISO>|<seconds>"` — MUST split on `|` before `new Date()`. `version` field for optimistic-conflict detection.

## Supabase
Single `draft_rooms` table: `id` (room code), `state` jsonb, `created_at`. RLS allows anon read/insert/update. pg_cron job `cleanup-old-rooms` deletes rooms >24h hourly. Realtime subscription on row UPDATE drives all clients. Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Player uses the new publishable key format.

## State shape (jsonb)
`{ config:{sets,playerCount,lang,includeHeroes,timerEnabled,timerSeconds,mode,cubeId}, players:[{id,name}], phase:'lobby'|'drafting'|'sealed'|'done', round, packs:{idx:[refs]}, picks:{idx:[refs]}, waitingFor:[idx], remainingPacks:[...], pickDeadline, version }`. Sealed uses `sealedPacks:{idx:[[pack],...]}` (array of 7 packs).

## Pages / routes
- `/` Home — create/join, `?join=CODE` prefill
- `/room/:code` Lobby — mode (Draft/Sealed), config tabs (Presets/Cubes/Advanced), set/lang/hero/timer, seat randomization on start, room share link + QR
- `/room/:code/draft` Draft — desktop split (pack | sidebar), mobile bottom tab bar (Pack/Picks/Stats)
- `/room/:code/sealed` Sealed — tabs Boosters(per-pack nav)/Full Pool/Deck/Stats
- `/room/:code/results` Results — tabs All Picks/Deck/Stats/Players

## Shared components
- `PoolGrid.jsx` — faction filter + group-by (faction/type/cost/set) + hover preview + ×N badge + deck +/- controls. Also exports `SimpleCardGrid` (grid+preview, no controls). Heroes grouped INSIDE their faction (top) when grouping by faction.
- `DeckList.jsx` — deck grouped by faction, heroes at top with "(Hero)" tag, − to remove.
- `DraftStats.jsx` — faction split (all 6 shown from 0), sets, card types (permanents merged), rarity, hand+recall cost curves (hover tooltip), biome power totals.
- `CardPreview.jsx` — fixed bottom-right large card via portal.
- Deckbuilder: pool=picks/sealed pool, deck stored in localStorage (`{ref:qty}`). Validity: ≥30 non-hero cards, ≤3 factions, hero optional. Used in both Sealed and Results.

## Identity / persistence
Player identity in **localStorage** (`player_{code}`) — survives refresh. Draft page offers name-based rejoin if missing. Decks in localStorage per room+player.

## Conventions
- Plain React hooks, no useCallback for handlers that read changing state (caused a stale-closure bug where cube sealed always used CORE — avoid).
- Tailwind dark theme, amber accent (`amber-500`), faction colors in `tailwind.config.js` + `FACTION_COLORS`/bar colors.
- Mobile: `md:` breakpoint splits desktop/mobile layouts. Responsive grids `grid-cols-3 sm:4 md:5 lg:6`.

## Roadmap (remaining)
Sprint 4: bot players (greedy faction strategy), card flagging, asymmetric pack distribution. Sprint 5: spectator mode, saved personal cubes, more community cubes. Waiting on assets: FUGUE logo, Exalted gem.
