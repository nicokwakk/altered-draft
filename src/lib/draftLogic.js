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
 * Apply a HERO pick during the in-app hero-draft phase. Mirrors `applyPick` but on
 * the parallel hero fields (`heroPacks`/`heroPicks`/`heroWaitingFor`/`heroRound`).
 * Hero boosters are equal-size and rotate just like card packs; when they're all
 * empty the hero draft is over and we hand off to the (already-seeded) card draft.
 */
export function applyHeroPick(state, playerIndex, heroReference) {
  const pi = String(playerIndex)
  const currentPack = [...(state.heroPacks?.[pi] ?? [])]
  const cardIdx = currentPack.indexOf(heroReference)
  if (cardIdx === -1) return state // stale pick, ignore

  currentPack.splice(cardIdx, 1)
  const newHeroPacks = { ...state.heroPacks, [pi]: currentPack }
  const newHeroPicks = {
    ...state.heroPicks,
    [pi]: [...(state.heroPicks?.[pi] ?? []), heroReference],
  }
  const newWaiting = (state.heroWaitingFor ?? []).filter(idx => idx !== playerIndex)

  let nextState = {
    ...state,
    heroPacks: newHeroPacks,
    heroPicks: newHeroPicks,
    heroWaitingFor: newWaiting,
  }

  if (newWaiting.length === 0) {
    const packsEmpty = Object.values(newHeroPacks).every(p => p.length === 0)
    if (packsEmpty) {
      // Hero draft complete → start the card draft. Round 1 packs were seeded by
      // buildInitialState and have sat dormant; just flip the phase and arm it.
      nextState = {
        ...nextState,
        phase: 'drafting',
        heroWaitingFor: [],
        waitingFor: allPlayerIndices(state.players.length),
        pickDeadline: freshDeadline(nextState),
      }
    } else {
      const rotated = rotatePacks(newHeroPacks, state.players.length, state.heroRound ?? 1)
      nextState = {
        ...nextState,
        heroPacks: rotated,
        heroRound: (state.heroRound ?? 1) + 1,
        heroWaitingFor: allPlayerIndices(state.players.length),
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
 * @param {string[][]} [heroPacks] - optional: one hero booster per seat. When given,
 *   the draft opens in a `heroDraft` phase (heroes are drafted first, like cards);
 *   the card-draft fields below are seeded but stay dormant until heroes are done.
 */
export function buildInitialState(config, players, allPacks, heroPacks = null) {
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

  // Optional in-app hero draft: runs BEFORE the card draft. Each seat gets one
  // hero booster; they rotate and are picked like cards until empty, then the
  // phase flips to 'drafting' (applyHeroPick handles the hand-off).
  if (heroPacks && heroPacks.length) {
    state.phase = 'heroDraft'
    state.heroRound = 1
    state.heroPacks = {}
    state.heroPicks = {}
    for (let i = 0; i < playerCount; i++) {
      state.heroPacks[String(i)] = heroPacks[i] ?? []
      state.heroPicks[String(i)] = []
    }
    state.heroWaitingFor = allPlayerIndices(playerCount)
  }

  state.pickDeadline = freshDeadline(state)
  return state
}
