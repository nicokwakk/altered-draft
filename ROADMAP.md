# Altered Draft Simulator — Roadmap

Working notes for upcoming work, kept in the repo so it's available from any machine.
See `CLAUDE.md` for full project/architecture context.

## Planned

### 1. Import Marcus' cube (data-only) — ACTIVE, blocked on the full card list
A cube created by a game designer — add it the same manual way as LuigiNico's, no new tooling.
- **Blocker:** the current list is **missing a few cards** — author is completing it. Don't finalise `refs[]`/`cardCount` until the full list lands.
- Add an object to `COMMUNITY_CUBES` in `src/lib/cubes.js` (`id, name, author, description, cardCount, refs[]`, plus `heroDraft`/`heroes`/`booster`/`maxPlayers` if it applies).
- Convert official identifiers (e.g. `BTG-131-U-894`) to internal refs `ALT_<SET>_B_<FAC>_<n>_<rarity>`. Out-of-faction cards use their real `_R2` ref (see the OOF note in `CLAUDE.md`); uniques stay as-is.
- If it has uniques: bundle them into `src/lib/uniquesData.js` (`UNIQUES_EN`) and download images to `public/uniques/<ref>.jpg` (API: `api.altered.gg/cards/<ref>?locale=en-us`) — do it while the API is still up.
- Add a `booster` recipe (`{ commons, rares, uniques }`) if the rarity mix can't use the classic split — see `generateCubeRecipePacks` in `src/lib/packGenerator.js`.
- **Heroes:** has 12 heroes → set `heroDraft: true` + `heroes:[…12 refs]`; the in-app hero draft (shipped) then handles it. Cap `maxPlayers` to whatever the pool size supports (LuigiNico = 4 because 192 = 4×4×12).
- Source CSV parsed so far: 12 heroes + 367 cards across **all 6 factions** (Ordis + Yzmir included, so no faction relabel needed); rarities C / R / O (off-faction) / U. Uncertain entries still need author input or substitution (no live API): `Halua (unique ?)`, `Nike Unique à 6`, `Spotter Unique`, `Jumper R ?`, `Sakarabru?`, blank-rarity `Wingsuit Jumper` — plus the not-yet-listed missing cards.

### 2. Personal cubes via paste — NO accounts (priority)
Let anyone run their own cube by **copy/pasting a decklist of cards** — no logins, no builder UI, no server-side storage. "Saving" = keep your own text list (or a shareable URL); accounts are explicitly out of scope.
- **Paste format:** one card per line. Accept what `Export` already produces (`<qty> <reference>`), plus a tolerant `<qty>x <name>` mode; optional `Heroes:` section for hero-draft cubes; optional 4th column / token for faction reassignment (OOF).
- **Parser + resolver:** reuse the name→reference resolver (built for LuigiNico/Marcus) — normalise names, resolve to refs, keep duplicates (multi-copy), and **surface unresolved lines** instead of failing silently. Uniques resolve from bundled data only (no live API).
- **Carry the cube in room state, not a `cubeId`.** Cubes today are hardcoded in `cubes.js` and referenced by `cubeId`; a pasted cube has no id. Store the resolved list **inline** in `config.customCube = { name, cards:[refs], factions?:[...] , heroes?:[...] }` so all players sync it via Realtime.
- **Lobby UI:** a "Load from list" textarea in the Cubes tab → parse → reuse `CubePreviewModal` to confirm → Start. Validate before enabling Start (size, player-count cap from pool size).
- **Wire into both modes:** draft → `generateCubeDraftPacks` / `generateCubeRecipePacks` (+ `generateHeroDraftPacks` if a `Heroes:` section is present); sealed → existing cube-sealed pool. Gate on `config.customCube` like `cube.heroDraft`/`cube.booster` are gated today.

### 3. Merge the Advanced + Chaos draft tabs
Reduce the number of options by combining them into one tab with a toggle:
**"All players receive the same type of packs."**
- Today: Advanced (draft) merges selected sets into one pool → standard multi-set boosters, everyone equivalent (`generateAllPacks`, `src/pages/Lobby.jsx`); Chaos builds a per-set single-set booster bag, shuffled and dealt at random (`generateChaosPacks`). Selectors: `SetSelector.jsx` vs `ChaosSelector.jsx`.
- Target: one tab + checkbox. ON = structured/equal (advanced-style); OFF = random distribution (chaos-style).
- **Open design decision:** booster composition when ON (single-set per player vs merged multi-set pool) and selector count semantics (per-player sum 4 vs total bag sum players×4). Likely: one per-set selector, toggle only changes distribution.
- Touch points in `Lobby.jsx`: tab list, the Advanced/Chaos UI blocks, the two draft handlers, and the start-button validation.

### 4. Winston draft (new 2-player mode)
A take-or-pass format that's a great fit for 2-player cube play.
- Mechanics: shuffle the pool into a main stack; keep 3 face-down piles. On your turn, look at pile 1 → **take it** (refill that pile from the main stack) or **pass** (drop the top of the main stack onto that pile, move to the next). Pass all 3 → take the blind top card of the main stack. Continue until the stack is empty. 2 players only.
- Different flow from pack-and-pass rotation: needs its own draft mode/phase + state (main stack, the 3 piles, whose turn) synced via `draft_rooms` + realtime, and its own UI (not the `CardGrid` pack view). Pure transitions in `src/lib/draftLogic.js`, seeded by a `buildInitialState`-style helper. Works naturally with a cube's single shuffled pool.

## Recently shipped

- **In-app hero draft** (was Planned #3 — done). For `heroDraft` cubes, heroes are drafted in a dedicated `heroDraft` phase **before** the card draft. `generateHeroDraftPacks(heroes, players)` partitions the 12 heroes into one equal booster per seat; if 12 isn't divisible by the player count it drops the random remainder (5p → drop 2 → five of 2; 4p → four of 3; 2p → two of 6). Boosters rotate and are picked like cards (`applyHeroPick` mirrors `applyPick` on parallel `heroPacks`/`heroPicks`/`heroWaitingFor`/`heroRound`); when empty, phase flips to `drafting`. Drafted heroes merge into each seat's Results pool (deck still uses ≤1 hero). `Draft.jsx` is phase-aware; the old manual `HeroDraftInfo.jsx` panel was deleted. Per-cube `maxPlayers` (default 4). Non-cube modes are unaffected (the hero path only activates when `cube.heroDraft` is set).

## Candidate / backlog (ideas from other drafting sites)
- **Draft log & replay** — record each seat's picks *and* passes; review after the draft.
- **Cube analytics** — extend `CubePreviewModal` with curve / faction-balance / rarity stats.
- Lower priority: Grid draft, Rochester, Rotisserie alternate formats.

## Waiting on assets
- FUGUE logo, Exalted gem (currently fall back to text / reuse the rare gem).

## Dropped (do not implement)
- Accounts / logins of any kind (personal cubes are paste-based instead).
- Bot players; asymmetric pack distribution (superseded by Chaos); spectator mode; card flagging (built then reverted — not wanted).
