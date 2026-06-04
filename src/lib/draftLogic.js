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
      // A card round just finished. Hero-draft cubes interleave a snake hero pass
      // here: after each round, every player takes ONE hero from the shared pool,
      // until each has `heroTarget` (3, or 2 at 5+ players).
      const passesDone = state.heroPassesDone ?? 0
      const needHero = state.heroPool && passesDone < (state.heroTarget ?? 0)
        && state.heroPool.length >= state.players.length
      if (needHero) {
        // Pause the card draft for a snake hero pass (round + remainingPacks intact;
        // applyHeroPick resumes the card draft when the pass ends).
        nextState = {
          ...nextState,
          phase: 'heroDraft',
          heroOrder: heroOrderFor(state.players.length, passesDone),
          heroTurnPos: 0,
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
 * Snake pick order for hero pass `n`: seat order, reversed on odd passes so the
 * first/last pick alternates from one pass to the next.
 */
export function heroOrderFor(playerCount, passIndex) {
  const base = allPlayerIndices(playerCount)
  return passIndex % 2 === 0 ? base : base.reverse()
}

/**
 * Apply a HERO pick. Heroes are drafted from ONE shared pool of all the cube's heroes
 * via a simple snake draft: after each card round, every player takes one hero (in
 * snake order) from the pool — repeated until each player has `heroTarget` heroes
 * (3, or 2 at 5+ players). Only the player whose turn it is (heroOrder[heroTurnPos])
 * may pick. When a pass finishes, the card draft resumes at the next round (or the
 * draft ends after the final round). State: heroPool (remaining heroes), heroTarget,
 * heroPassesDone (= heroes each player has so far), heroOrder + heroTurnPos (whose
 * turn), heroPicks.
 */
export function applyHeroPick(state, playerIndex, heroReference) {
  const order = state.heroOrder ?? []
  if (order[state.heroTurnPos] !== playerIndex) return state // not this player's turn
  const pool = [...(state.heroPool ?? [])]
  const ci = pool.indexOf(heroReference)
  if (ci === -1) return state // stale / no longer available

  pool.splice(ci, 1)
  const pi = String(playerIndex)
  const newHeroPicks = {
    ...state.heroPicks,
    [pi]: [...(state.heroPicks?.[pi] ?? []), heroReference],
  }

  let nextState = { ...state, heroPool: pool, heroPicks: newHeroPicks }

  const nextPos = state.heroTurnPos + 1
  if (nextPos < state.players.length) {
    // Same pass, next player in the snake order.
    nextState = { ...nextState, heroTurnPos: nextPos, pickDeadline: freshDeadline(nextState) }
  } else {
    // Pass complete — everyone took one hero this round. Resume the card draft at the
    // next round, or finish if it was the last round.
    const passesDone = (state.heroPassesDone ?? 0) + 1
    if (state.round >= 4) {
      nextState = { ...nextState, phase: 'done', heroPassesDone: passesDone, heroTurnPos: 0, pickDeadline: null }
    } else {
      const remaining = state.remainingPacks ?? []
      nextState = {
        ...nextState,
        phase: 'drafting',
        round: state.round + 1,
        packs: remaining[0] ?? {},
        remainingPacks: remaining.slice(1),
        waitingFor: allPlayerIndices(state.players.length),
        heroPassesDone: passesDone,
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
 * @param {string[]} [heroPool] - optional in-app hero draft: ONE shared pool of all the
 *   cube's heroes. After each card round every player snake-drafts one hero from it,
 *   until each has `heroTarget` (3, or 2 at 5+ players). `applyPick` pauses into the
 *   `heroDraft` phase after each round; `applyHeroPick` resumes the cards after.
 */
export function buildInitialState(config, players, allPacks, heroPool = null) {
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

  // Optional in-app hero draft: one shared pool of all the cube's heroes, snake-drafted
  // one-per-player after each card round until each has heroTarget. heroTarget caps at
  // 3 (2 at 5+ players) and at floor(pool/players) so the pool never runs short.
  if (heroPool && heroPool.length) {
    const target = Math.min(playerCount >= 5 ? 2 : 3, Math.floor(heroPool.length / playerCount))
    state.heroPool = heroPool
    state.heroTarget = Math.max(0, target)
    state.heroPassesDone = 0
    state.heroPicks = {}
    for (let i = 0; i < playerCount; i++) state.heroPicks[String(i)] = []
  }

  state.pickDeadline = freshDeadline(state)
  return state
}
