/**
 * Rotisserie draft — pure state transitions (immutable updates), mirroring rochesterLogic.js.
 *
 * No packs: the ENTIRE draftable pool is laid out face-up and players take turns drafting any
 * single card in snake order until each has `target` cards (fantasy-draft style). Fully open
 * information — like Rochester, but one shared pool for the whole draft instead of a pack at a
 * time.
 *
 * State (phase: 'rotisserie'): pool (the shared face-up pool of refs, with duplicates), a global
 * snake `pickOrder` + `turnPos`, `target` (cards each player drafts), and the usual
 * picks/config/players/version/pickDeadline. Optional finishing hero snake (heroMode='draft'),
 * handled by the generalized applyHeroPick in draftLogic.js.
 */

import { makeDeadline } from '../components/PickTimer.jsx'
import { heroOrderFor } from './draftLogic.js'
import { rochesterOrder } from './rochesterLogic.js' // generic snake-order helper

// Cards each player drafts. Capped so the pool keeps meaningful choices to the end rather than
// being drained to forced last picks; adapts down for small pools.
const ROTISSERIE_CAP = 45

function freshDeadline(state) {
  const seconds = state.config?.timerSeconds
  if (!state.config?.timerEnabled || !seconds) return null
  return makeDeadline(seconds)
}

export function buildRotisserieState(config, players, allPacks, heroPool = null) {
  const playerCount = players.length
  // The generated packs already represent the draftable cards — flatten them into one pool.
  const pool = (allPacks ?? []).flat().filter(Boolean)
  const target = Math.max(1, Math.min(ROTISSERIE_CAP, Math.floor(pool.length / playerCount)))
  const totalPicks = target * playerCount

  const picks = {}
  for (let i = 0; i < playerCount; i++) picks[String(i)] = []

  const state = {
    config,
    players,
    phase: 'rotisserie',
    pool,
    pickOrder: rochesterOrder(playerCount, totalPicks, 0),
    turnPos: 0,
    target,
    picks,
    pickDeadline: null,
    version: 0,
  }

  if (heroPool && heroPool.length) {
    const ht = Math.min(playerCount >= 5 ? 2 : 3, Math.floor(heroPool.length / playerCount))
    state.heroPool = heroPool
    state.heroTarget = Math.max(0, ht)
    state.heroPassesDone = 0
    state.heroPicks = {}
    for (let i = 0; i < playerCount; i++) state.heroPicks[String(i)] = []
  }

  state.pickDeadline = freshDeadline(state)
  return state
}

/**
 * Apply a Rotisserie pick. Only the seat at pickOrder[turnPos] may pick, and only a card still
 * in the pool. Removes one copy; when the snake finishes (target reached) or the pool empties,
 * runs the finishing hero snake (if any) or ends the draft.
 */
export function applyRotisseriePick(state, seat, ref) {
  const order = state.pickOrder ?? []
  if (order[state.turnPos] !== seat) return state // not this seat's turn
  const pool = [...(state.pool ?? [])]
  const idx = pool.indexOf(ref)
  if (idx === -1) return state // stale — copy already taken

  pool.splice(idx, 1)
  const si = String(seat)
  const picks = { ...state.picks, [si]: [...(state.picks[si] ?? []), ref] }

  let next = { ...state, pool, picks }

  const nextPos = state.turnPos + 1
  if (nextPos < order.length && pool.length > 0) {
    next.turnPos = nextPos
    next.pickDeadline = freshDeadline(next)
    return next
  }

  // Draft complete. Run the finishing hero snake if one is pending; else finish.
  const playerCount = state.players.length
  const needHero = next.heroPool && next.heroPool.length >= playerCount
    && (next.heroPassesDone ?? 0) < (next.heroTarget ?? 0)
  if (needHero) {
    next = {
      ...next,
      phase: 'heroDraft',
      heroFinish: true,
      heroOrder: heroOrderFor(playerCount, next.heroPassesDone ?? 0),
      heroTurnPos: 0,
    }
    next.pickDeadline = freshDeadline(next)
    return next
  }

  next.phase = 'done'
  next.pickDeadline = null
  return next
}
