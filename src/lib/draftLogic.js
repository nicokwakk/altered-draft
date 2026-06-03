/**
 * Pure functions for draft state transitions.
 * All functions return a new state object (immutable updates).
 */

import { makeDeadline } from '../components/PickTimer.jsx'

function freshDeadline(state) {
  const seconds = state.config?.timerSeconds
  if (!state.config?.timerEnabled || !seconds) return null
  return makeDeadline(seconds)
}

/**
 * Direction: pack 1 & 3 pass left (index - 1), pack 2 & 4 pass right (index + 1).
 */
export function passDirection(round) {
  return round % 2 === 1 ? 'left' : 'right'
}

/**
 * Rotate packs among players according to the current round direction.
 * @param {object} packs - { "0": [...], "1": [...], ... }
 * @param {number} playerCount
 * @param {number} round - 1-indexed
 * @returns {object} new packs map
 */
export function rotatePacks(packs, playerCount, round) {
  const dir = passDirection(round)
  const newPacks = {}

  for (let i = 0; i < playerCount; i++) {
    let from
    if (dir === 'left') {
      // pack moves left: player i receives from player i+1
      from = (i + 1) % playerCount
    } else {
      // pack moves right: player i receives from player i-1
      from = (i - 1 + playerCount) % playerCount
    }
    newPacks[String(i)] = packs[String(from)] ?? []
  }

  return newPacks
}

/**
 * Apply a pick action and return the next full state.
 */
export function applyPick(state, playerIndex, cardReference) {
  const pi = String(playerIndex)
  const currentPack = [...(state.packs[pi] ?? [])]
  const cardIdx = currentPack.indexOf(cardReference)
  if (cardIdx === -1) return state // stale pick, ignore

  // Remove card from pack, add to picks
  currentPack.splice(cardIdx, 1)

  const newPacks = { ...state.packs, [pi]: currentPack }
  const newPicks = {
    ...state.picks,
    [pi]: [...(state.picks[pi] ?? []), cardReference],
  }

  // Remove player from waitingFor
  const newWaiting = state.waitingFor.filter(idx => idx !== playerIndex)

  let nextState = {
    ...state,
    packs: newPacks,
    picks: newPicks,
    waitingFor: newWaiting,
  }

  // When all players have picked, rotate packs
  if (newWaiting.length === 0) {
    const packsEmpty = Object.values(newPacks).every(p => p.length === 0)

    if (packsEmpty) {
      // A card round just finished. Hero-draft cubes can interleave a hero segment
      // here per their schedule (e.g. 1 hero after round 1, the rest after round 2).
      const stop = heroStopAfter(state, state.round)
      if (stop) {
        // Pause the card draft and run a turn-based hero segment. round + remainingPacks
        // are left intact; applyHeroPick resumes the card draft when the segment ends.
        const start = state.heroDrafted ?? 0
        nextState = {
          ...nextState,
          phase: 'heroDraft',
          heroBoosterIndex: start,
          heroCurrent: [...state.heroBoosters[start]],
          heroOrder: heroOrderFor(state.players.length, start),
          heroTurnPos: 0,
          heroSegmentThrough: stop.throughBooster,
          pickDeadline: freshDeadline(nextState),
        }
      } else if (state.round >= 4) {
        nextState.phase = 'done'
      } else {
        const nextRound = state.round + 1
        const remaining = state.remainingPacks ?? []
        const freshPacks = remaining[0] ?? {}
        nextState = {
          ...nextState,
          round: nextRound,
          packs: freshPacks,
          remainingPacks: remaining.slice(1),
          waitingFor: allPlayerIndices(state.players.length),
          pickDeadline: freshDeadline(nextState),
        }
      }
    } else {
      // Rotate packs
      const rotated = rotatePacks(newPacks, state.players.length, state.round)
      nextState = {
        ...nextState,
        packs: rotated,
        waitingFor: allPlayerIndices(state.players.length),
        pickDeadline: freshDeadline(nextState),
      }
    }
  }

  return nextState
}

/**
 * Snake pick order for a hero booster: seat order, reversed on odd boosters so the
 * first/last pick rotates fairly from one booster to the next.
 */
export function heroOrderFor(playerCount, boosterIndex) {
  const base = allPlayerIndices(playerCount)
  return boosterIndex % 2 === 0 ? base : base.reverse()
}

/**
 * Resolve a cube's hero schedule into concrete stops. `schedule` is a list of
 * `{ afterRound, boosters }` where `boosters` is a number or 'rest'. Returns
 * `[{ afterRound, throughBooster }]` (cumulative booster counts), capped at the
 * real booster count; any leftover boosters fold into the last stop. e.g. schedule
 * [{afterRound:1, boosters:1}, {afterRound:2, boosters:'rest'}] with 3 boosters →
 * [{afterRound:1, through:1}, {afterRound:2, through:3}] (1 hero after round 1, 2 after round 2).
 */
function resolveHeroStops(schedule, totalBoosters) {
  let cum = 0
  const stops = []
  for (const s of (schedule ?? [])) {
    if (cum >= totalBoosters) break
    const want = s.boosters === 'rest'
      ? totalBoosters - cum
      : Math.max(0, Math.min(s.boosters ?? 0, totalBoosters - cum))
    if (want > 0) { cum += want; stops.push({ afterRound: s.afterRound, throughBooster: cum }) }
  }
  if (cum < totalBoosters) {
    if (stops.length) stops[stops.length - 1].throughBooster = totalBoosters
    else stops.push({ afterRound: 4, throughBooster: totalBoosters })
  }
  return stops
}

/** The pending hero stop (if any) for the card round that just finished. */
function heroStopAfter(state, round) {
  const done = state.heroDrafted ?? 0
  for (const s of (state.heroStops ?? [])) {
    if (s.afterRound === round && done < s.throughBooster) return s
  }
  return null
}

/**
 * Apply a HERO pick during a (turn-based) hero-draft segment. Heroes are drafted
 * from shared boosters sized to the table: each booster holds exactly `players`
 * heroes and is drafted one pick per player in snake order, so nobody ever picks
 * twice from the same booster. Only the player whose turn it is (heroOrder[heroTurnPos])
 * may pick. Hero segments are interleaved between card rounds per the cube schedule
 * (heroStops); when a segment's last booster (heroSegmentThrough) empties, the card
 * draft resumes at the next round — or the draft finishes if it was the final round.
 * State: heroBoosters[] (all boosters), heroBoosterIndex (live one), heroCurrent (its
 * remaining heroes), heroOrder + heroTurnPos (whose turn), heroSegmentThrough (booster
 * index this segment ends at), heroDrafted (boosters completed so far), heroPicks.
 */
export function applyHeroPick(state, playerIndex, heroReference) {
  const order = state.heroOrder ?? []
  if (order[state.heroTurnPos] !== playerIndex) return state // not this player's turn
  const current = [...(state.heroCurrent ?? [])]
  const ci = current.indexOf(heroReference)
  if (ci === -1) return state // stale / no longer available

  current.splice(ci, 1)
  const pi = String(playerIndex)
  const newHeroPicks = {
    ...state.heroPicks,
    [pi]: [...(state.heroPicks?.[pi] ?? []), heroReference],
  }

  let nextState = { ...state, heroCurrent: current, heroPicks: newHeroPicks }

  const nextPos = state.heroTurnPos + 1
  if (nextPos < state.players.length) {
    // Same booster, next player in the snake order.
    nextState = { ...nextState, heroTurnPos: nextPos, pickDeadline: freshDeadline(nextState) }
  } else {
    // Booster exhausted (everyone picked once).
    const nextBooster = (state.heroBoosterIndex ?? 0) + 1
    const through = state.heroSegmentThrough ?? (state.heroBoosters?.length ?? 0)
    if (nextBooster < through) {
      // Still within this segment → open the next booster.
      nextState = {
        ...nextState,
        heroBoosterIndex: nextBooster,
        heroCurrent: [...state.heroBoosters[nextBooster]],
        heroOrder: heroOrderFor(state.players.length, nextBooster),
        heroTurnPos: 0,
        pickDeadline: freshDeadline(nextState),
      }
    } else {
      // Segment complete → resume the card draft at the next round, or finish.
      const drafted = nextBooster // boosters completed so far (cumulative)
      if (state.round >= 4) {
        nextState = { ...nextState, phase: 'done', heroDrafted: drafted, heroTurnPos: 0, pickDeadline: null }
      } else {
        const remaining = state.remainingPacks ?? []
        nextState = {
          ...nextState,
          phase: 'drafting',
          round: state.round + 1,
          packs: remaining[0] ?? {},
          remainingPacks: remaining.slice(1),
          waitingFor: allPlayerIndices(state.players.length),
          heroDrafted: drafted,
          heroTurnPos: 0,
          pickDeadline: freshDeadline(nextState),
        }
      }
    }
  }

  return nextState
}

export function allPlayerIndices(count) {
  return Array.from({ length: count }, (_, i) => i)
}

/**
 * Build the initial draft state from generated packs.
 * @param {object} config
 * @param {object[]} players
 * @param {string[][]} allPacks - flat array, first playerCount packs go to round 1
 * @param {{boosters: string[][], schedule?: {afterRound:number, boosters:number|'rest'}[]}} [heroDraft]
 *   optional in-app hero draft: N shared boosters (each sized to the table) plus a
 *   schedule of when to draft them between card rounds (default: all after round 4).
 *   The card draft runs normally; `applyPick` pauses into the turn-based `heroDraft`
 *   phase at each scheduled stop, and `applyHeroPick` resumes the cards after.
 */
export function buildInitialState(config, players, allPacks, heroDraft = null) {
  const playerCount = players.length
  const initialPacks = {}
  for (let i = 0; i < playerCount; i++) {
    initialPacks[String(i)] = allPacks[i] ?? []
  }
  const initialPicks = {}
  for (let i = 0; i < playerCount; i++) {
    initialPicks[String(i)] = []
  }

  // Store remaining packs (rounds 2-4) for later generation
  const remainingPacks = []
  for (let round = 1; round < 4; round++) {
    const roundPacks = {}
    for (let i = 0; i < playerCount; i++) {
      roundPacks[String(i)] = allPacks[round * playerCount + i] ?? []
    }
    remainingPacks.push(roundPacks)
  }

  const state = {
    config,
    players,
    phase: 'drafting',
    round: 1,
    packs: initialPacks,
    picks: initialPicks,
    waitingFor: allPlayerIndices(playerCount),
    remainingPacks,
    pickDeadline: null,
    version: 0,
  }

  // Optional in-app hero draft, interleaved between card rounds per the cube's
  // schedule (default: all heroes after the final round). Stash the shared boosters,
  // the resolved stops, and an empty heroPicks map; applyPick enters the turn-based
  // 'heroDraft' phase at each scheduled stop (applyHeroPick takes over from there).
  if (heroDraft && heroDraft.boosters?.length) {
    state.heroBoosters = heroDraft.boosters
    state.heroStops = resolveHeroStops(
      heroDraft.schedule ?? [{ afterRound: 4, boosters: 'rest' }],
      heroDraft.boosters.length,
    )
    state.heroDrafted = 0
    state.heroPicks = {}
    for (let i = 0; i < playerCount; i++) state.heroPicks[String(i)] = []
  }

  state.pickDeadline = freshDeadline(state)
  return state
}
