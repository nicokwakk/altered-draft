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

### 2. Winston draft (new 2-player mode)
A take-or-pass format that's a great fit for 2-player cube play.
- Mechanics: shuffle the pool into a main stack; keep 3 face-down piles. On your turn, look at pile 1 → **take it** (refill that pile from the main stack) or **pass** (drop the top of the main stack onto that pile, move to the next). Pass all 3 → take the blind top card of the main stack. Continue until the stack is empty. 2 players only.
- Different flow from pack-and-pass rotation: needs its own draft mode/phase + state (main stack, the 3 piles, whose turn) synced via `draft_rooms` + realtime, and its own UI (not the `CardGrid` pack view). Pure transitions in `src/lib/draftLogic.js`, seeded by a `buildInitialState`-style helper. Works naturally with a cube's single shuffled pool.

## Recently shipped

- **Personal cubes via paste** (was Planned #2 — done). NO accounts / storage. In the **Cubes tab**, a "＋ Paste your own cube" panel takes a name + a decklist (`<qty> <REF>` lines, the Export format; tolerant of space-separated runs). `parseDecklist` (`src/lib/cubeParser.js`) tokenises → refs with quantities (refs-only, no name resolution since the API is retiring). On **Parse**, refs are resolved against set data (+ bundled uniques): **heroes auto-detected** (`cardType === 'HERO'`) and split out, duplicates kept, **unresolved refs surfaced** (callout) and skipped. The cube is carried **inline** as `config.customCube = { name, cards:[refs], heroes:[refs] }` (no `cubeId`), synced via Realtime. **Draft:** `generateCubeDraftPacks` (multiset, equal packs) on the non-hero pool; heroes use the shared-pool snake draft when `uniqueHeroes ≥ players`, else they fold into the packs. **Sealed:** heroes stay in the pool, 7 multiset boosters per player. Player cap auto-derived (blocks if too few cards). Preview reuses `CubePreviewModal` (`author: 'You'`). `Draft.jsx`/`Results.jsx`/`Sealed.jsx` resolve uniques from `config.customCube` too. Mutually exclusive with built-in cube selection. _(Dropped from the original plan: name resolution, `Heroes:` section, OOF faction column, shareable URL — all unneeded for refs-only paste.)_
- **Merged "Multi-Set" draft tab** (was Planned #3 — done). Advanced + Chaos collapsed into ONE draft tab named **Multi-Set** with a checkbox **"All players receive the same packs"** (default ON, `config.equalPacks`). One per-set selector (`MultiSetSelector.jsx`) whose required total follows the toggle: **ON → counts are per-player, sum = 4**; **OFF → counts are the whole bag, sum = players × 4** (`MultiSetSelector` `target` is 4 / players×4). Both modes deal SINGLE-SET boosters (never a merged pool): **ON** → `generateStructuredPacks` gives every seat the same set per round (one set per round, identical set-pure draft for all); **OFF** → the bag counts go straight to `generateChaosPacks`, shuffled and dealt at random. Stored as `config.multiSetMix` + `config.equalPacks`. The custom-pool textarea override moved onto this tab. **DRAFT only** — sealed keeps its own Advanced tab (`SetSelector` + `generateChaosPacks` per `packMix`) untouched. Removed: `ChaosSelector.jsx`, `config.chaosMix`, and the old merged-pool Advanced *draft* path (`generateAllPacks` now serves presets/cube/custom-pool only). `generateChaosPacks` stays (Multi-Set OFF + non-cube sealed).
- **In-app hero draft** (was Planned #3 — done). For `heroDraft` cubes, heroes are snake-drafted from ONE shared pool of all the cube's heroes (`cube.heroes`): **one hero per player after each card round**, until each has `min(3, floor(pool/players))` → **3 at 2-4 players, 2 at 5-6**. Turn-based snake (`heroOrderFor`, reversed on odd passes). `applyPick` pauses into `heroDraft` after each round (round/remainingPacks intact); `applyHeroPick` resumes the cards after the pass (or `done` after the final round). State: `heroPool`/`heroTarget`/`heroPassesDone`/`heroOrder`/`heroTurnPos`/`heroPicks`. Drafted heroes merge into each seat's Results pool (deck still uses ≤1 hero). `Draft.jsx` is phase-aware ("You have X/N heroes", off-turn "waiting for <name>"); the old manual `HeroDraftInfo.jsx` panel was deleted. **Both cubes use it:** LuigiNico (12 heroes, maxPlayers 4) and the **All Sets cube** (12 heroes split out of its pool, 336→324 cards, maxPlayers 6). Per-cube `maxPlayers` (default 4). Non-cube modes unaffected (hero path only activates when `cube.heroDraft` is set). _(Earlier booster-per-round / per-cube-schedule designs were scrapped as over-complex.)_

## Candidate / backlog (ideas from other drafting sites)
- **Draft log & replay** — record each seat's picks *and* passes; review after the draft.
- **Cube analytics** — extend `CubePreviewModal` with curve / faction-balance / rarity stats.
- Lower priority: Grid draft, Rochester, Rotisserie alternate formats.

## Waiting on assets
- FUGUE logo, Exalted gem (currently fall back to text / reuse the rare gem).

## Dropped (do not implement)
- Accounts / logins of any kind (personal cubes are paste-based instead).
- Bot players; asymmetric pack distribution (superseded by Chaos); spectator mode; card flagging (built then reverted — not wanted).
