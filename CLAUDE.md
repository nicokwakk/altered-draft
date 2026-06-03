# Altered Draft Simulator — Project Memory

Multiplayer booster-draft + sealed simulator for the Altered TCG. React (Vite) + Tailwind + Supabase Realtime. No backend. Deployed on Vercel at https://altered-draft.vercel.app

## Environment / workflow
- Developed on **both Windows and macOS** — check which you're on first.
  - **macOS:** bash; Node available (`/opt/homebrew/bin/node`). On a fresh checkout `node_modules` may be absent — run `npm install` once, then verify with `npm run build` (vite) before pushing.
  - **Windows:** use the **PowerShell** tool for git. Node may NOT be on PATH there — if `npm`/build is unavailable, verify by reasoning and rely on the Vercel deploy.
- `git push 2>&1` may print to stderr / show a red wrapper even on success — that's normal, check the last line for `main -> main`.
- Commit + push after each change so Vercel auto-deploys (push to `main`). Repo: github.com/nicokwakk/altered-draft. Commit author already configured.
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
- **Uniques** (`…_U_<serial>`, e.g. `ALT_CORE_B_AX_04_U_1437`) aren't in the community set files. `fetchUnique`/`fetchUniques` resolve them. The 24 cube uniques are **bundled locally** — data in `src/lib/uniquesData.js` (`UNIQUES_EN`), images in `public/uniques/<ref>.jpg` (served at `/uniques/<ref>.jpg`). Altered's API (`api.altered.gg/cards/<ref>?locale=…`) is being retired, so `fetchUnique` serves the bundled EN copy first (no network); other uniques / non-EN locales still fetch live while the API is up, then fall back to the bundled EN snapshot on failure. To regenerate the snapshot (if a unique is swapped), re-run the fetch-and-download script that hits the API for each ref, writes `uniquesData.js`, and saves each `imagePath` to `public/uniques/`.
- **Printing variants:** reference is `ALT_<SET>_<PRINT>_<FACTION>_<NUM>_<RARITY>`. `<PRINT>`: `B` = real booster card, `A` = alternate-art reprint (12–36/set), `P` = promo (0–18). A/P are the same gameplay card as their B twin. `fetchSet` filters to **B only** (`isStandardPrinting`) so each card has one canonical printing — otherwise dedup-by-name could keep the alt-art `A` (e.g. Mechanical Training showed `ALT_CORE_A_AX_22_C` instead of `_B_`). Every A has a B twin; only 2 promo-exclusive P cards (ALIZE OR_48, BISE BR_64, high numbers) lack a B and are intentionally dropped.

## Sets (`SETS` in cardData.js)
CORE=Beyond the Gates(BTG), COREKS=BTG KS (hidden:true, not a preset), ALIZE=Trial by Frost(TBF), BISE=Whisper from the Maze(WTM), CYCLONE=Skybound Odyssey(SKY), DUSTER=Seeds of Unity(SDU), EOLE=Roots of Corruption(ROC), FUGUE=Neverending Journey(NEJ). Internal codes hidden from UI; show names/abbreviations. See `SET_ABBREV`, `SET_FULL_NAMES`, `SET_ABBREV_ICON_CODE`.

## Assets (`src/lib/assets.js`)
Faction icons, rarity gems, set icons/logos all from `https://cdn.alteredcore.org/marketing/...`. No FUGUE logo or Exalted gem available yet (EX reuses rare gem; FUGUE/CORE fall back to text). `setCodeFromRef(ref)` = `ref.split('_')[1]`.

## Booster composition (`src/lib/packGenerator.js`)
13 cards: 1 hero + 9 commons (1 per faction + 3 paired draws AX|BR, LY|MU, OR|YZ) + 3 rares (1-in-8 packs swaps last rare for a unique). `generateAllPacks(cards, players, packsPerPlayer, {includeHeroes, cubeMode})`. Pools deduplicated by `name+faction`. `splitPools()` helper shared by all generators.
**Cube mode** (`generateCubePacks`, used only by the cube-DRAFT path): each card appears at most once, and EVERY pack is the SAME size (unequal packs deadlock the pass rotation — see Draft logic). It does NOT force 9C+3R structure (that depletes pools unevenly and breaks mid-sized cubes). Instead: 1 hero/pack when heroes ≥ totalPacks (else heroes fold into the body or are excluded), then an equal `bodyPerPack = min(13 - heroSlot, floor(body/totalPacks))` cards from the shuffled commons+rares+uniques; leftovers unused. So pack size scales with cube size (e.g. 147-card cube, 4 players → 16 packs of 9). Sealed cube uses normal boosters (`cubeMode` off), NOT this.
**Multi-copy cubes** (`cube.heroDraft` flag, e.g. LuigiNico's): a cube may run intentional duplicate copies. The Lobby cube-draft branch builds the pool as a MULTISET (`cube.refs.map(r => byRef.get(r))`, NOT a dedup filter) and deals it with `generateCubeDraftPacks(cardObjects, totalPacks)` — shuffle, equal packs of `min(13, floor(n/totalPacks))`, no dedup, no hero slot. Restricted to 2-4 players. Heroes are NOT in packs; they're snake-drafted **manually** (the app only DISPLAYS the 12-hero pool + rules via `HeroDraftInfo.jsx` on the Draft and Results pages, gated on the active cube's `heroDraft`). The hero protocol: random/chosen starting player; after pack 2 each takes 1 hero (start → clockwise); after the draft each takes 1 more (last picker → counter-clockwise). `cube.heroes` holds the 12 display refs.
**Out-of-faction cards = the R2 printing (NOT a relabel).** Altered prints each card number in up to three rarities that encode faction: `_C` = common (home faction), `_R1` = rare (same faction as C, may have different cost/stats/effects), `_R2` = rare in a DIFFERENT faction (the "out-of-faction"/OOF/"o" print — its own faction, art, AND stats). So an OOF card is a genuinely different card object: use its real `_R2` ref, whose `mainFaction` already IS the OOF faction. NOTE: the ref string keeps the home-faction letters (e.g. `ALT_ALIZE_B_YZ_45_R2` reads "YZ" but `mainFaction` is AX) — so derive faction from the card OBJECT (`mainFaction`), never by parsing the ref. A card wanted in two columns appears as two distinct refs: `_R1` in its home column, `_R2` in the OOF column. This makes any per-card `cube.factions` override unnecessary (an earlier faction-relabel/token hack was removed once refs were corrected to R2). `CubePreviewModal` parses refs offline but prefers the loaded card's `mainFaction` for faction. **Uniques (`_U_<serial>`) are left as-is** — a unique legitimately exists in either faction the card is printed in; do NOT swap a unique to R2 or override its faction.
**Chaos draft** (`generateChaosPacks(cardsBySet, packMix, {includeHeroes})`): each booster is a single-set pack (normal composition). Host picks any number of boosters per set (NOT a multiple of player count); total must equal players×4. All boosters shuffled together → flat array → `buildInitialState` deals one random pack per seat per round. Draft only. Config tab `chaos` (hidden in sealed). Stored as `config.chaosMix`. UI: `ChaosSelector.jsx`.
**Sealed booster generation:** presets/advanced sealed ALSO build single-set boosters via `generateChaosPacks` (a booster never mixes sets). Preset = 7 boosters of the one set; advanced = per-set counts from `SetSelector` (count literally = # single-set boosters of that set; total = pool size, NOT forced to 7). Stored as `config.packMix`. Only **cube** sealed uses a merged pool (curated pool, boosters mix the cube's sets — intentional). Pre-2026-06 bug: presets/advanced sealed merged all sets → packs contained mixed-set cards; fixed.

## Draft logic (`src/lib/draftLogic.js`)
Pure transitions. `applyPick(state, idx, ref)`. Pass left rounds 1&3, right 2&4. `pickDeadline` (timer) format is `"<ISO>|<seconds>"` — MUST split on `|` before `new Date()`. `buildInitialState` seeds `version: 0` (REQUIRED — the optimistic-lock filter matches on it).
**Optimistic concurrency (Draft.jsx `doPick`):** players pick from their own packs simultaneously, so a blind write clobbers concurrent picks. `doPick` does a conditional update `.eq('id', code).eq('state->>version', expectedVersion).select('id')`; if it returns 0 rows (conflict), it re-fetches the latest state and retries (≤12 attempts, jittered). `inFlightRef` is a hard lock against overlapping invocations (timer + click), separate from the `picking` UI flag (which realtime clears on every update). All packs in a round MUST be equal size or rotation deadlocks (official sets always yield 13-card packs: 1 hero + 9 commons + 3 rares).

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
Saved personal cubes (cube builder UI), more community cubes (just data). Waiting on assets: FUGUE logo, Exalted gem.
Dropped (do not implement): bot players, asymmetric pack distribution (superseded by Chaos), spectator mode, card flagging (built then reverted — user didn't want it).
