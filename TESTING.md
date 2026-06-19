# Testing checklist — recent batch (Jun 2026)

Everything shipped in the recent push that needs a real check on the deployed site
(https://altered-draft.vercel.app). Most multiplayer items need **two browsers / tabs** (open the
room link in a second tab as a 2nd player). Tick as you go.

---

## 1. Lobby wizard (mode → cards → settings)
- [ ] Step 1 shows **Booster Draft** then **Sealed** first; **▶ Other draft options** expands Rochester / Rotisserie / Winston.
- [ ] If you pick an "other" mode, leave, and come back, the toggle is **auto-expanded** (selection visible).
- [ ] **Next** is disabled on step 2 until a valid pool is chosen; **Back** returns without losing choices.
- [ ] Step indicator (1 · 2 · 3) reflects the current step.
- [ ] Switching to **Sealed** swaps the card tab to **Advanced** (not Multi-Set) and hides the pick timer in settings.
- [ ] Switching to **Winston** with ≠ 2 players shows "Needs exactly 2", and **Start** is disabled.
- [ ] Non-host sees "Waiting for the host…" (no wizard).

## 2. Card sources (step 2), per mode
- [ ] **Presets** helper text is mode-aware: draft "drafts 4 packs", Winston "12 boosters pooled and split", Sealed "7 packs".
- [ ] **Multi-Set** (draft): the target updates per mode — booster needs 4/player (or players×4 in the bag), **Winston needs 12** — and the X/target counter validates.
- [ ] **Advanced** (sealed): new styled rows (set icon + −/+ stepper); "Boosters per player" total turns green at **7**; you can still build any size.
- [ ] **Cubes** still work as a source (built-in cube, paste-your-own, load-from-Re:Union) for the chosen mode.

## 3. Mode-driven pool size (check final pool at Results/Sealed)
- [ ] **Booster Draft** (2p): each player ends ~52 cards. *(unchanged baseline)*
- [ ] **Winston** (2p): each player ends **~72 cards** (the key change — was ~48).
- [ ] **Sealed**: 7 boosters/player (~90 cards). *(unchanged)*
- [ ] **Rochester / Rotisserie**: 4 boosters/player feel unchanged.

## 4. Random uniques in packs
- [ ] Toggle appears in settings **only for booster sources** (presets/multi-set), **not on the Cubes tab**, for both draft and sealed.
- [ ] **Off by default** → no uniques appear (same as before).
- [ ] **On** → roughly **1 in 6 boosters** has a real unique in its **last slot**; the "can take up to a minute" warning shows.
- [ ] Uniques render with **real art** in the draft pack, in Results, and in Sealed pools.
- [ ] **Both players** see the uniques (not just the host) — confirm in the 2nd tab.
- [ ] Perf: with the toggle on while you sit on the settings step, **Start feels snappy** (pool was prefetched).

## 5. Winston (2 players, two browsers)
- [ ] **Heroes = Shuffle into pool**: heroes appear as normal cards you take via piles.
- [ ] **Heroes = Free pick**: every hero is available at deckbuild for both players.
- [ ] **Heroes = Random split**: each player has their own **6 heroes, one per faction** in their pool at Results (best tested on the 12-hero all-sets cube; a single set has only ~6 heroes total so the split is thinner).
- [ ] Board: piles render as a **card-back stack with a big count**; only the **active** player sees the current pile's cards; the waiting player sees all piles face-down.
- [ ] **Take** adds the pile to your pool and refills it; **Pass** grows the pile / moves on; passing all three **draws blind**.
- [ ] The blind-drawn card shows **"You drew this off the deck"**, highlighted, **only to you**.
- [ ] Draft terminates cleanly (deck empties → last pile must be taken) and goes to Results with ~72 cards each.

## 6. Hover zoom / full-card view (draft)
- [ ] Hovering a card in the **pack grid** (booster/rochester) grows it **in place** (no more bottom-right panel).
- [ ] Cards near the **screen edge** anchor so the zoom doesn't get clipped off-screen.
- [ ] **Rotisserie** pool and **Winston** piles + hero strip all zoom in place too.
- [ ] On Winston cards: hover is **bigger (2x)** and **clicking opens a full-size lightbox** (Esc or click-outside closes).

## 7. Alternate formats end-to-end (still need a real multiplayer playtest)
- [ ] **Rochester**: one shared face-up pack, snake order, only the active seat can pick, pack counter advances, → Results with correct pools.
- [ ] **Rotisserie**: whole pool face-up, snake picks, stops at the per-player cap (45), → Results.
- [ ] **Winston**: covered in §5.
- [ ] Heroes = Draft (snake) still works for Rochester/Rotisserie (hero snake runs after the cards).

## 8. Regression — make sure the basics still work
- [ ] **Booster Draft** (the classic), 2+ players, plays start-to-finish.
- [ ] **Sealed** (presets + advanced) opens, builds, saves.
- [ ] **Cube** draft and sealed (built-in + pasted) still work.
- [ ] **Re:Union**: connect, load a deck as a cube, **save pool + deck** still work.
- [ ] **Mobile** (narrow window): wizard, draft pack grid, and the Winston board are usable.

---

### Notes / things to watch — RESOLVED (fixed/verified, no need to re-check)
- ~~Winston + Multi-Set "same packs" toggle~~ — **fixed**: the toggle is now hidden for Winston (replaced by "All boosters are pooled… and split"), and it forces the whole-bag total (12).
- ~~Uniques in a non-EN language~~ — **verified**: the cards API returns all five locales; `normalizeAlteredCore` picks the right name and falls back to the EN image if a locale's art is missing.
- ~~Split-hero faction bucketing~~ — **verified**: the all-sets heroes are standard `ALT_<SET>_B_<FAC>_NN_C` refs (exactly 2 per faction), so the ref's faction letters bucket them correctly.
