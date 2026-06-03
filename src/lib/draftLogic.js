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
      // End of a round
      if (state.round >= 4) {
        // Card draft finished. If this cube also drafts heroes, start the hero
        // phase now (heroes are drafted AFTER the cards — see applyHeroPick).
        if (state.heroBoosters && state.heroBoosters.length) {
          nextState = {
            ...nextState,
            phase: 'heroDraft',
            heroBoosterIndex: 0,
            heroCurrent: [...state.heroBoosters[0]],
            heroOrder: heroOrderFor(state.players.length, 0),
            heroTurnPos: 0,
            pickDeadline: freshDeadline(nextState),
          }
        } else {
          nextState.phase = 'done'
        }
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
 * Apply a HERO pick during the (post-card) hero-draft phase. Heroes are drafted
 * TURN-BASED from shared boosters sized to the table: each booster holds exactly
 * `players` heroes and is drafted one pick per player in snake order, so nobody
 * ever picks twice from the same booster. Only the player whose turn it is
 * (heroOrder[heroTurnPos]) may pick. When the last booster empties, the draft is
 * done. State: heroBoosters[] (all boosters), heroBoosterIndex (which one is live),
 * heroCurrent (its remaining heroes), heroOrder + heroTurnPos (whose turn), heroPicks.
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
    // Booster exhausted (everyone picked once) → next booster, or finish.
    const nextBooster = (state.heroBoosterIndex ?? 0) + 1
    if (nextBooster >= (state.heroBoosters?.length ?? 0)) {
      nextState = { ...nextState, phase: 'done', heroTurnPos: 0, pickDeadline: null }
    } else {
      nextState = {
        ...nextState,
        heroBoosterIndex: nextBooster,
        heroCurrent: [...state.heroBoosters[nextBooster]],
        heroOrder: heroOrderFor(state.players.length, nextBooster),
        heroTurnPos: 0,
        pickDeadline: freshDeadline(nextState),
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
 * @param {string[][]} [heroBoosters] - optional: N shared hero boosters (each sized to
 *   the table). When given, the heroes are drafted turn-based AFTER the 4 card packs:
 *   the card draft runs normally, then `applyPick`'s end-of-draft switches into the
 *   `heroDraft` phase instead of `done` (see applyHeroPick).
 */
export function buildInitialState(config, players, allPacks, heroBoosters = null) {
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

  // Optional in-app hero draft, drafted AFTER the card draft. Stash the shared hero
  // boosters and an empty heroPicks map now; the card draft runs first (phase stays
  // 'drafting'), then applyPick switches to the turn-based 'heroDraft' phase once the
  // 4th pack is done (applyHeroPick takes over from there).
  if (heroBoosters && heroBoosters.length) {
    state.heroBoosters = heroBoosters
    state.heroPicks = {}
    for (let i = 0; i < playerCount; i++) state.heroPicks[String(i)] = []
  }

  state.pickDeadline = freshDeadline(state)
  return state
}
