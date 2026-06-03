# Altered Draft Simulator — Roadmap

Working notes for upcoming work, kept in the repo so it's available from any machine.
See `CLAUDE.md` for full project/architecture context.

## Planned

### 1. Import Marcus' cube (data-only)
A cube created by a game designer — add it the same manual way as LuigiNico's, no new tooling.
- Add an object to `COMMUNITY_CUBES` in `src/lib/cubes.js` (`id, name, author, description, cardCount, refs[]`, plus `heroDraft`/`heroes`/`booster` if it applies).
- Convert official identifiers (e.g. `BTG-131-U-894`) to internal refs `ALT_<SET>_B_<FAC>_<n>_<rarity>`. Out-of-faction cards use their real `_R2` ref (see the OOF note in `CLAUDE.md`); uniques stay as-is.
- If it has uniques: bundle them into `src/lib/uniquesData.js` (`UNIQUES_EN`) and download images to `public/uniques/<ref>.jpg` (API: `api.altered.gg/cards/<ref>?locale=en-us`).
- Add a `booster` recipe (`{ commons, rares, uniques }`) if the rarity mix can't use the classic split — see `generateCubeRecipePacks` in `src/lib/packGenerator.js`.

### 2. Merge the Advanced + Chaos draft tabs
Reduce the number of options by combining them into one tab with a toggle:
**"All players receive the same type of packs."**
- Today: Advanced (draft) merges selected sets into one pool → standard multi-set boosters, everyone equivalent (`generateAllPacks`, `src/pages/Lobby.jsx`); Chaos builds a per-set single-set booster bag, shuffled and dealt at random (`generateChaosPacks`). Selectors: `SetSelector.jsx` vs `ChaosSelector.jsx`.
- Target: one tab + checkbox. ON = structured/equal (advanced-style); OFF = random distribution (chaos-style).
- **Open design decision:** booster composition when ON (single-set per player vs merged multi-set pool) and selector count semantics (per-player sum 4 vs total bag sum players×4). Likely: one per-set selector, toggle only changes distribution.
- Touch points in `Lobby.jsx`: tab list, the Advanced/Chaos UI blocks, the two draft handlers, and the start-button validation.

### 3. Automate in-app hero drafting per cube rules
`src/components/HeroDraftInfo.jsx` is currently display-only (shows the 12 heroes + rules; players pick manually). Implement the snake protocol in-app for `heroDraft` cubes:
- Choose/assign a starting player; after pack 2 each takes 1 hero (start → clockwise); after the draft each takes 1 more (last picker → counter-clockwise). `cube.heroes` holds the 12 refs.
- New state (e.g. `state.heroPicks`, `state.heroTurn`) synced via the existing `draft_rooms` row + realtime; reuse the optimistic-concurrency pattern from `Draft.jsx` `doPick` and put pure transitions in `src/lib/draftLogic.js`. Show picked heroes on Draft + Results.

### 4. Winston draft (new 2-player mode)
A take-or-pass format that's a great fit for 2-player cube play.
- Mechanics: shuffle the pool into a main stack; keep 3 face-down piles. On your turn, look at pile 1 → **take it** (refill that pile from the main stack) or **pass** (drop the top of the main stack onto that pile, move to the next). Pass all 3 → take the blind top card of the main stack. Continue until the stack is empty. 2 players only.
- Different flow from pack-and-pass rotation: needs its own draft mode/phase + state (main stack, the 3 piles, whose turn) synced via `draft_rooms` + realtime, and its own UI (not the `CardGrid` pack view). Pure transitions in `src/lib/draftLogic.js`, seeded by a `buildInitialState`-style helper. Works naturally with a cube's single shuffled pool.

## Candidate / backlog (ideas from other drafting sites)
- **Draft log & replay** — record each seat's picks *and* passes; review after the draft (also handy to verify the hero protocol).
- **Generic cube import** — add a cube by pasting/uploading a ref list (auto-fetch data + uniques) instead of editing `cubes.js`. Natural follow-up to #1.
- **Cube builder UI + saved personal cubes** — build/save your own cubes in-app (localStorage or shareable).
- **Cube analytics** — extend `CubePreviewModal` with curve / faction-balance / rarity stats.
- Lower priority: Grid draft, Rochester, Rotisserie alternate formats.

## Waiting on assets
- FUGUE logo, Exalted gem (currently fall back to text / reuse the rare gem).

## Dropped (do not implement)
- Bot players; asymmetric pack distribution (superseded by Chaos); spectator mode; card flagging (built then reverted — not wanted).
