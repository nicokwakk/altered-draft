# Altered Draft Simulator — Roadmap

Working notes for upcoming work, kept in the repo so it's available from any machine.
See `CLAUDE.md` for full project/architecture context.

Context (June 2026): the site was shared on the Altered Discord and got a strong reception.
Equinox (the publisher) is winding down; **Re:Union / Altered Reunion** is the official
community project keeping Altered alive — and its dev reached out to integrate. The two
forces shaping this roadmap are (1) building toward that Re:Union integration and (2) a
closing window on the old `api.altered.gg` card/unique API before it's retired.

---

## Now — active priorities (in order)

### 1. Re:Union (Altered Reunion) account integration — NEW, blocked on dev deliverables
Connect the app to the **official Re:Union identity** so logged-in users can push their
drafted deck straight into their account. This does NOT mean building our own accounts
(see Dropped) — Re:Union owns the identity layer (Keycloak), DB, and auth; we're a client.
Strictly **optional and additive**: anonymous use (paste cubes, localStorage decks, file
export) is unchanged; "Connect Re:Union" just unlocks extras for those who opt in.

**✅ Auth FOUNDATION shipped (June 2026):** login/logout works in code — `api/token.js`
(serverless code↔token exchange), `src/lib/reunion.js` (PKCE OIDC client), `AuthProvider` +
`useAuth()`, `/auth/callback` route, `ReunionButton` on Home. Deployed and **verified live end-to-end**: a real user logged in (redirect URIs registered by the
dev) and their pseudo renders — the full Connect → Keycloak → callback → token exchange (function +
`KEYCLOAK_CLIENT_SECRET`) → userinfo flow works.

**✅ Step 2 (deck read/write) shipped (June 2026) — pending live user test.** Both features built +
deployed; the proxy layer is verified live (no-auth → our 401; bogus token → upstream's 401, proving
forwarding). Decks API `https://decks.alteredcore.org` via same-origin Vercel proxies
(`api/decks/index.js` GET list/POST create, `api/decks/[id].js` GET detail) forwarding the Bearer token
(no browser CORS). **Load a cube from your decks** (Lobby Cubes tab) and **save pool + final deck**
(one `ExportMenu` dropdown on Results/Sealed). Shared `resolveCubeRefs` (`src/lib/cubeResolve.js`) turns
deck cards into a cube like paste. **UX pass shipped (17 Jun 2026)** after first live testing: deck picker
now fetches the WHOLE list (`itemsPerPage=1000&order[name]=asc`) with a name-search box + format-filter
chips + a Preview-cube button; the 4 export/save buttons collapsed into one **Export / Save** dropdown
(copy card list, copy decklist, save pulls, save deck); saves use **`format:'sandbox'`** and are named
`"<code> · <Draft|Sealed> <pool|deck> · DDMM"`. Decks-API contract (format enum, query filters) confirmed
from the live OpenAPI `https://decks.alteredcore.org/api/docs.json`. **Still watch on live save:** (a) a 403
→ add a deck scope to `SCOPES` in `reunion.js`; (b) a sandbox pool/deck rejected → surface the API error
(the dropdown shows "failed" with the message). **Not feasible:** a deck-size (≥80 cards) picker filter —
the list endpoint returns no card count (only the per-deck detail does).
_Hardening fast-follow: move the refresh token to an httpOnly cookie._

**Auth setup (provided by the Re:Union dev):**
- Protocol: **OpenID Connect** via **Keycloak**.
- Issuer / base: `https://auth.altered.re/`, realm `players`
  (discovery: `https://auth.altered.re/realms/players/.well-known/openid-configuration`).
- `clientId`: `altered-draft`. **Confidential client** (a client secret exists).
- **Client secret is NEVER in git / never in the browser bundle / never pasted into chat or repo.**

**Decided architecture — confidential client + one Vercel Serverless Function:**
- The app is a frontend-only static SPA, so the secret can't live client-side. A single
  stateless Vercel function (e.g. `/api/token`) holds the secret as a **Vercel env var**
  (`KEYCLOAK_CLIENT_SECRET`) and performs the `code → token` exchange (+ refresh). Still no
  database, still no real backend — just one function. (Public-client+PKCE was the
  alternative; we chose to keep his confidential client and add the function.)
- Use **Authorization Code + PKCE** on top (defense in depth; Keycloak supports both).
- Flow: SPA redirects to Keycloak → user logs in → back to `/auth/callback?code=…` →
  SPA POSTs the code to `/api/token` → function exchanges it (with the secret) → returns the
  user's access/refresh tokens → SPA calls the Re:Union **decks API** with the user's Bearer token.
- Public OIDC config (issuer, realm, clientId) can be plain constants / `VITE_` vars; only the
  secret is server-side.

**Local dev environment FOUND — `github.com/Altered-Community/altered-dev-environment`.**
A .NET Aspire stack that runs the WHOLE Re:Union backend locally, so we can build AND test the
integration end-to-end without waiting on the dev:
- **Keycloak** (realm `players`) at `http://auth.altered.local.gd:18080`, admin `admin`/`admin`;
  test users `alice`/`bob` (pw `TestPassword1234`). `*.local.gd` → 127.0.0.1 (no hosts-file edit).
- **decks-api** at `http://localhost:8001` (the deck-write target); **collection-api** OpenAPI at
  `http://localhost:8002/api/docs`. Read the deck contract straight from the running API.
- Register our own **confidential `altered-draft`** client via the realm seed
  `AlteredAuth/dev/clean.js` (then restart `altered-auth`): redirect `http://localhost:5173/auth/callback`,
  web-origin `http://localhost:5173`; copy its secret. `DEV_AUTH_ENABLED` (HS256 `iss:dev`) shortcut
  exists for testing deck-writes without the full login.
- Confirms our architecture: the decks-api "uses a confidential client requiring consent."
- Prereqs (ALL on one machine — `*.local.gd` is 127.0.0.1): Docker, .NET 10 SDK, Aspire CLI, plus
  Node + Vercel CLI for our `vercel dev` side. Run `./run.ps1` / `./run.sh`.
- **Setup deferred — not started (user's call).** This Windows box has only `git` on PATH; macOS
  already has Node, likely the lighter lift.

**Decks API contract — FOUND in `github.com/Altered-Community/alteredcore-website`**
(the `equinox-deck-import` plugin's `CurlDeckApiClient.php` + `Domain/{Card,Deck}.php`):
- Auth: `Authorization: Bearer <user access token>` + `Accept: application/json`.
- **List my decks:** `GET {base}/api/decks` → array (or `{items|decks|data:[...]}` wrapper).
- **Deck detail (with cards):** `GET {base}/api/decks/{id}` → full deck incl. `deckCards`.
- **Create:** `POST {base}/api/decks` JSON `{ name, format:"standard", isPublic:false, isDraft:false,
  deckCards:[{cardReference:"ALT_…", quantity:1-99}] }` → 2xx `{ id }`. Hero = just a 1-of entry in
  `deckCards`. Card ref must match `^ALT_[A-Z0-9_]+$` (uppercase).
- Maps cleanly to both objectives: load-cube = GET list → GET {id} → expand `deckCards`; save =
  POST twice (pool + final deck).

**Resolved by probing (step 2 now effectively unblocked):**
- **Prod base URL = `https://decks.alteredcore.org`** ✅ (`GET /api/decks` → 401
  `application/problem+json` "Full authentication is required"; Symfony API behind Cloudflare).
- **CORS → MUST proxy** ✅ — preflight returns allow-methods/headers but **no `Access-Control-Allow-Origin`**
  for our origin, so direct browser calls are blocked. Route decks calls through **Vercel proxy functions**
  (`api/decks…`) that forward the user's Bearer token server-side (BFF pattern; also enables the httpOnly
  hardening later).
- **Scope:** resource APIs validate the realm JWT signature (per dev-env README), so our `openid profile`
  token is very likely accepted as-is — confirm on the first authenticated call; add a scope only if it 403s.

**Feature tiers (each maps to a Keycloak/API scope — ask for these, ship in this order):**
- 🟢 **`deck:write`** — one-click "Save deck to my Re:Union account" at the end of a
  draft/sealed; optionally save the whole pool as a deck. *Smallest, most-requested, highest
  delight — ship first.*
- 🟢 **`deck:read`** — build a custom cube/pool from one of your account decks (solves the
  recurring "how do I import decks?" ask without a separate parser).
- 🟡 **`collection:read`** — "draft from my collection", owned/not-owned overlay during the
  draft, post-draft "missing cards" report, auto-build a cube from your collection.
- 🟡 **`profile:read`** — persistent name/avatar (no retyping each room), account-based rejoin
  across devices, draft history, optional authenticated rooms.
- 🔴 **card-data API (strategic)** — if Re:Union exposes card + unique data, it can replace the
  dying `api.altered.gg` and largely dissolve priority #2 below. Uncertain — treat #2 as a hedge.

### 2. Uniques — dying-API dependency REMOVED ✅ (bundling now just an offline hedge)
**✅ Shipped (June 2026):** `fetchUnique` was the last live caller of the retiring
`api.altered.gg` (hit for any non-bundled unique or non-EN locale). Repointed it to
**`cards.alteredcore.org/api/cards?reference=<ref>`** — the durable community API that resolves
**any** unique. New `normalizeAlteredCore` adapter for its JSON shape; `prodImage()` host-swaps
the locked `altered-dev` S3 bucket → public `altered-prod-eu`; CORS verified; bundled EN snapshot
kept as offline/fast path + failure fallback. `api.altered.gg` is no longer referenced anywhere.
So unique-heavy community cubes (CptKawaii's "cube unique", wordcandy70's "Uniques Cube") now
resolve durably, not just our 24.

**Remaining (optional, no deadline):** bundle MORE unique images locally as a resilience/perf
hedge (in case the prod S3 bucket later locks down too). Only 24 are bundled
(`src/lib/uniquesData.js` `UNIQUES_EN` + `public/uniques/<ref>.jpg`); everything else now loads
live from `cards.alteredcore.org` + prod bucket.

**New durable data source (tested June 2026):** `api.altered.gg` is being retired, but the
community site **`cards.alteredcore.org`** serves the same data and should outlive it.
- **Endpoint:** `https://cards.alteredcore.org/api/cards?reference=<REF>` (Symfony / API
  Platform; no auth). Returns `{ member: [<card>], totalItems }`. The single-id path
  (`/api/cards/<ref>`) 500s — always use the `?reference=` filter.
- **Verified:** all 24 bundled uniques **+** an arbitrary new ref (`ALT_CORE_B_AX_16_U_5075`)
  resolve with full data, and `faction.code` matches our hardcoded factions exactly — including
  every out-of-faction case (e.g. `..._AX_16_U_...` → Bravos, `..._BR_19_...` → Lyra). So this
  source can snapshot **any** unique, not just our 24, even after the old API dies.
- **Different JSON shape** than the old API (needs its own adapter, NOT `normalizeCard`):
  `name` / `imagePath` / `cardType.name` are **per-locale objects** (use `.en`); faction is
  `faction.code` + `faction.name`; `rarity.reference`; `cardType.reference`; and **flat integer**
  `mainCost` / `recallCost` / `forestPower` / `mountainPower` / `oceanPower` (no `#...#` markers).
- **⚠️ Image gotcha:** the API's `imagePath.en` points at the **locked** `altered-dev.s3.eu-west-3.amazonaws.com`
  bucket (403 AccessDenied, even with UA/referer). The **same file is public on the prod bucket** —
  swap the host to **`altered-prod-eu.s3.amazonaws.com`** (path + filename hash identical) → 200
  JPEG. (The old `api.altered.gg` also still returns the prod URL directly while it's up.)

**Action (snapshot script, when refs are in hand — no code yet):** for each unique ref, GET
`cards.alteredcore.org/api/cards?reference=<ref>`, map the fields above into a `UNIQUES_EN`
entry, and download the art from the **prod**-bucket URL (host-swap the returned `imagePath.en`)
to `public/uniques/<ref>.jpg`. Commit the script this time (the original wasn't committed).
Prioritise refs from the community cubes people are actually pasting. Needs Node → run on macOS
(not on PATH on Windows).
- **Urgency reassessed:** card **data** is now future-proofed by `cards.alteredcore.org`, so this
  is no longer a hard deadline for metadata. **Art still depends on the prod S3 bucket staying
  public** — so grabbing images sooner is the remaining time-sensitive part. May later be
  superseded if Re:Union ships its own card-data + image API (1🔴), but that's not guaranteed.
- Possible enhancement: accept a pasted list of unique refs and snapshot them on demand.

### 3. Import Marcus' cube (data-only) — ACTIVE, blocked on the full card list
A cube by a game designer (MarcusK, engaged on Discord). Add it the manual way, like LuigiNico's.
- **Blocker:** the current list is **missing a few cards** — author is completing it. Don't
  finalise `refs[]`/`cardCount` until the full list lands.
- Add an object to `COMMUNITY_CUBES` in `src/lib/cubes.js` (`id, name, author, description,
  cardCount, refs[]`, plus `heroDraft`/`heroes`/`booster`/`maxPlayers` if it applies).
- Convert official identifiers (e.g. `BTG-131-U-894`) to internal refs
  `ALT_<SET>_B_<FAC>_<n>_<rarity>`. Out-of-faction cards use their real `_R2` ref (see the OOF
  note in `CLAUDE.md`); uniques stay as-is.
- If it has uniques, bundle them (see #2 — same script) while the API is up.
- Add a `booster` recipe (`{ commons, rares, uniques }`) if the rarity mix can't use the classic
  split — see `generateCubeRecipePacks` in `src/lib/packGenerator.js`.
- **Heroes:** has 12 heroes → set `heroDraft: true` + `heroes:[…12 refs]`; the in-app hero draft
  (shipped) handles it. Cap `maxPlayers` to what the pool supports (LuigiNico = 4 because 192 = 4×4×12).
- Source CSV parsed so far: 12 heroes + 367 cards across **all 6 factions** (Ordis + Yzmir
  included, no faction relabel needed); rarities C / R / O (off-faction) / U. Uncertain entries
  still need author input or substitution (no live API): `Halua (unique ?)`, `Nike Unique à 6`,
  `Spotter Unique`, `Jumper R ?`, `Sakarabru?`, blank-rarity `Wingsuit Jumper` — plus the
  not-yet-listed missing cards.

---

## Planned

### From live testing (17 Jun 2026) — mostly SHIPPED
Backlog captured after the user tried the deployed app; the batch was built the same day.

- **✅ Bug — top-nav wordmark sent in-room users to room creation.** `TopNav` now uses
  `useParams`: inside a room the wordmark links to that room's lobby instead of `/`.
- **✅ Free hero choice (all heroes available).** A single **Heroes** control in the lobby (radio:
  **In packs** | **Free choice**, replacing the two overlapping checkboxes) drives `heroMode` →
  `includeHeroes`/`config.freeHero`. Free choice keeps heroes out of all packs/boosters (every mode,
  draft + sealed); the player picks any hero from the full roster at deckbuild via `HeroPicker`
  (Results + Sealed Deck tab). `packHeroes = includeHeroes && !freeHero` gates pack generation; cube
  hero-draft / sealed slot-0 / custom-cube hero folding are all skipped when on.
- **✅ Cube of the Month spotlight — live with "All Commons".** `SPOTLIGHT` in `cubes.js` points at
  the `all-commons` cube (192 commons, exactly 32 per faction, 12 heroes snake-drafted); banner atop
  the Cubes tab features it. Swap `SPOTLIGHT.cubeId`/`blurb` to rotate next month. Hero names were
  resolved to refs via `cards.alteredcore.org`; `ALT_COREKS_B_BR_03_C` stays OUT (it's Basira, a hero,
  already in the 12).
- **✅ Promo/alt-art cards in cubes.** `cardData.needsCardApi(ref)` (uniques + any non-booster print)
  now drives the cube "extra fetch" everywhere (Lobby draft+sealed, Draft, Sealed, Results,
  CubePreviewModal), so promo-ONLY cards with no booster print resolve from the cards API — e.g.
  "Sofia, First Outpost" (`ALT_BISE_P_BR_64_C`), the 32nd Bravos common in All Commons.
- **✅ Export/Save menu harmonized.** Parallel verb-noun labels (Copy/Save your pulls · your deck)
  with a count on every row.
- **◑ Graphic polish — first pass done.** Light-mode page background deepened so panels separate;
  more look-and-feel work (card grids, spacing, iconography) can continue once eyeballed.
- **◑ Menu improvements — Help + Feedback added.** `TopNav` now has a Help modal (`HelpModal`) and
  a gated Feedback link. **Remaining: provide the Feedback form URL** (`FEEDBACK_URL` in
  `src/lib/links.js`, currently empty → item hidden).
- **✅ Menu font matched to Altered Core.** AC's title font is the commercial **Tiller**; used
  **Fraunces** (closest free Google match) as `font-display`. Swap in real Tiller if licensed.
- **✅ Harden code for Re:Union — robustness pass done.** decks client: clearer 401/403 ("session
  expired") errors, empty-save guard, name trimmed to 150 chars, `toDeckCards` drops non-`ALT_`
  refs and clamps qty 1–99 per the live OpenAPI. **Still deferred (bigger):** move refresh token to
  an httpOnly cookie; open-sourcing under Altered-Community.

### ✅ Fix: heroes in built-in cube sealed — SHIPPED (verified not happening)
Hero-draft cubes (LuigiNico, All Sets, All Commons) used to deal **zero heroes** in sealed.
Resolved by `dealHeroSlots` (`src/lib/packGenerator.js`): each sealed booster gets a hero in
slot 0 drawn (with repetition) from `cube.heroes`, for both recipe and non-recipe cubes, with the
hero sets loaded so they render in `Sealed.jsx`. Confirmed live (Jun 2026). With **Free hero
choice** on, slot-0 heroes are skipped (you free-pick at deckbuild instead).

### Community / Spotlight cubes (rotating)
wordcandy70 & Kari (Casual Alterations) want to put up a **rotating monthly community cube**
(first: All Commons; others: a Uniques Cube, "Opps All Jellyfish", "Six Sets, Six Factions").
User likes the rotating-spotlight idea.
- **Option A (zero code):** they keep pasting their cube each month; signal-boost on Discord.
- **Option B (a feature):** a curated "Spotlight / Community cubes" section in the Cubes tab —
  add their cubes to `COMMUNITY_CUBES` like LuigiNico's, marked as featured/rotating.
- Note: a Uniques Cube depends hard on priority #2 (bundling uniques) to keep working.

### Deck import (decklist → pool/cube)
Recurring ask ("now have to figure how to import decks"). Pull a decklist INTO the site as a
sealed pool or a cube. We already parse the Export format (`parseDecklist` in
`src/lib/cubeParser.js`), so a standalone "import a decklist as a pool" is cheap. Overlaps with
Re:Union `deck:read` (1🟢) — decide whether to do the simple paste version now or fold it into
the Re:Union work.

### Winston draft (new 2-player mode)
A take-or-pass format, great for 2-player cube play.
- Mechanics: shuffle the pool into a main stack; keep 3 face-down piles. On your turn, look at
  pile 1 → **take it** (refill that pile from the main stack) or **pass** (drop the top of the
  main stack onto that pile, move to the next). Pass all 3 → take the blind top card of the main
  stack. Continue until the stack is empty. 2 players only.
- Needs its own draft mode/phase + state (main stack, the 3 piles, whose turn) synced via
  `draft_rooms` + realtime, and its own UI (not the `CardGrid` pack view). Pure transitions in
  `src/lib/draftLogic.js`, seeded by a `buildInitialState`-style helper. Works naturally with a
  cube's single shuffled pool.

### LuigiNico's newest cube (set 1–5) — PARKED by choice
Author shared a now-public [Google Sheet](https://docs.google.com/spreadsheets/d/1a3ZZ2AzzPp05rWJq9Mzt6torBro4noEC74Pn27KXxX0/edit?gid=0)
with tag-column notes, but it's **missing some uniques** ("add any six you feel like") and a bit
out of date. **Parked until set 6 is playable on BGA** (user's call). This is a DIFFERENT, newer
cube than the LuigiNico cube already in the app.

### Open-source under Altered-Community — eventually, not yet
The Re:Union dev offered to host the project open-source (with a license) on the official
[Altered-Community](https://github.com/Altered-Community) GitHub org. **Decision: move later, not
immediately** — get the Re:Union integration working first, then migrate. Before any public push:
(1) choose a license, (2) **scan the full git history to confirm no secret was ever committed**
(the Supabase publishable/anon key is fine; verify no secret key, no `.env`, no Keycloak secret).

---

## Recently shipped

- **Cube sealed booster labels fixed** (June 2026). Cube sealed packs are multiset, but the
  booster header labeled each by its first card's set (e.g. "Booster 2 · Skybound Odyssey 1/1").
  Now cube rooms (built-in or pasted) show the cube name, no set icon/ordinal; Multi-Set/Chaos
  sealed (genuinely single-set) unchanged. (`src/pages/Sealed.jsx`)
- **Usage monitoring** (June 2026). `draft_rooms` self-purges hourly (pg_cron `cleanup-old-rooms`,
  >24h), so a `room_stats(day, rooms_created)` table is tallied by the cron BEFORE the delete for
  permanent history. Snapshot + history queries documented in `supabase-monitoring.sql`.
- **Personal cubes via paste**. NO accounts / storage. Cubes tab "＋ Paste your own cube" panel
  (name + `<qty> <REF>` decklist). `parseDecklist` (`src/lib/cubeParser.js`) → refs with
  quantities (refs-only). On Parse: refs resolved against set data + bundled uniques, **heroes
  auto-detected** and split out, duplicates kept, **unresolved refs surfaced** (callout) and
  skipped. Carried inline as `config.customCube = { name, cards:[refs], heroes:[refs] }`, synced
  via Realtime. **Draft:** `generateCubeDraftPacks` on the non-hero multiset; heroes use the
  shared-pool snake draft when `uniqueHeroes ≥ players`, else fold into packs. **Sealed:** heroes
  stay in pool, 7 multiset boosters/player. Player cap auto-derived. Mutually exclusive with
  built-in cube selection. `Draft.jsx`/`Results.jsx`/`Sealed.jsx` resolve uniques from `customCube`.
- **Merged "Multi-Set" draft tab**. Advanced + Chaos → ONE draft tab with "All players receive the
  same packs" (default ON, `config.equalPacks`). One per-set selector (`MultiSetSelector.jsx`);
  required total follows the toggle: **ON → per-player, sum = 4**; **OFF → whole bag, sum =
  players × 4**. Both deal single-set boosters: ON → `generateStructuredPacks` (same set per round
  for all seats); OFF → `generateChaosPacks` (shuffled bag). Stored as `config.multiSetMix` +
  `config.equalPacks`. DRAFT only — sealed keeps its Advanced tab. Removed `ChaosSelector.jsx` +
  `config.chaosMix`.
- **In-app hero draft**. For `heroDraft` cubes, heroes are snake-drafted from ONE shared pool
  (`cube.heroes`): one hero per player after each card round, until each has `min(3,
  floor(pool/players))` → 3 at 2–4 players, 2 at 5–6. `applyPick` pauses into `heroDraft` after
  each round; `applyHeroPick` resumes. Drafted heroes merge into each seat's Results pool.
  `Draft.jsx` phase-aware. Used by LuigiNico (12 heroes, maxPlayers 4) and the All Sets cube
  (12 heroes, 324 cards, maxPlayers 6).

## Candidate / backlog (ideas from other drafting sites)
- **Draft log & replay** — record each seat's picks *and* passes; review after the draft.
- **Cube analytics** — extend `CubePreviewModal` with curve / faction-balance / rarity stats.
- Lower priority: Grid draft, Rochester, Rotisserie alternate formats.

## Waiting on assets
- FUGUE logo, Exalted gem (currently fall back to text / reuse the rare gem).

## Dropped (do not implement)
- **Homegrown accounts / login / user database** — still dropped. We do NOT build our own auth.
  NOTE: integrating with **Re:Union's official Keycloak OIDC** is a different thing and IS in scope
  (Now #1) — identity, DB and auth live on Re:Union's side; we only hold the client secret in a
  Vercel env var and call their API with the user's token. Personal cube *sharing* stays paste-based.
- Bot players; asymmetric pack distribution (superseded by Multi-Set/Chaos); spectator mode; card
  flagging (built then reverted — not wanted).
