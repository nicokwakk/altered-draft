/**
 * Rochester draft — pure state transitions (immutable updates), mirroring draftLogic.js.
 *
 * Unlike booster draft (every seat opens a pack simultaneously and passes), Rochester opens
 * ONE booster face-up for the whole table; players take turns picking from that single pack
 * in snake order until it's empty, then the next booster opens. Fully open information.
 *
 * State (phase: 'rochester'): activePack (the one face-up booster), packQueue (the rest),
 * pickOrder (snake seat sequence for the active pack) + turnPos (whose turn), opener (which
 * seat picks first in the active pack — rotates each pack so first-pick isn't always seat 0),
 * packNum/totalPacks (display), and the usual picks/config/players/version/pickDeadline.
 *
 * Optional hero snake: if heroMode='draft', a heroPool is attached at build time but the
 * snake runs AFTER all packs are drafted (a finishing 'heroDraft' phase marked heroFinish),
 * handled by the generalized applyHeroPick in draftLogic.js.
 */

import { makeDeadline } from '../components/PickTimer.jsx'
import { heroOrderFor, heroTargetFor } from './draftLogic.js'

function freshDeadline(state) {
  const seconds = state.config?.timerSeconds
  if (!state.config?.timerEnabled || !seconds) return null
  return makeDeadline(seconds)
}

/**
 * Snake seat sequence of `length` picks starting at `opener`: forward pass 0..N-1 (rotated
 * so it begins at `opener`), then reverse, repeating until `length` picks are covered.
 */
export function rochesterOrder(playerCount, length, opener = 0) {
  const seats = Array.from({ length: playerCount }, (_, i) => (opener + i) % playerCount)
  const order = []
  let forward = true
  while (order.length < length) {
    const pass = forward ? seats : [...seats].reverse()
    for (const s of pass) {
      if (order.length >= length) break
      order.push(s)
    }
    forward = !forward
  }
  return order
}

export function buildRochesterState(config, players, allPacks, heroPool = null) {
  const playerCount = players.length
  const packs = (allPacks ?? []).filter(p => p && p.length)
  const activePack = packs[0] ?? []
  const packQueue = packs.slice(1)

  const picks = {}
  for (let i = 0; i < playerCount; i++) picks[String(i)] = []

  const state = {
    config,
    players,
    phase: 'rochester',
    activePack,
    packQueue,
    pickOrder: rochesterOrder(playerCount, activePack.length, 0),
    turnPos: 0,
    opener: 0,
    packNum: 1,
    totalPacks: packs.length,
    picks,
    pickDeadline: null,
    version: 0,
  }

  // Optional in-app hero draft (heroMode='draft'): heroes are snake-drafted FIRST. Start in a
  // 'heroDraft' phase and flip to 'rochester' (the card fields above stay dormant) once each
  // player has `heroTarget` heroes.
  if (heroPool && heroPool.length) {
    state.phase = 'heroDraft'
    state.heroStart = 'rochester'
    state.heroPool = heroPool
    state.heroTarget = heroTargetFor(config, heroPool.length, playerCount)
    state.heroPassesDone = 0
    state.heroOrder = heroOrderFor(playerCount, 0)
    state.heroTurnPos = 0
    state.heroPicks = {}
    for (let i = 0; i < playerCount; i++) state.heroPicks[String(i)] = []
  }

  state.pickDeadline = freshDeadline(state)
  return state
}

/**
 * Apply a Rochester pick. Only the seat at pickOrder[turnPos] may pick, and only a card in
 * the active pack. Advances the snake; when the pack empties, opens the next (rotating the
 * opener) or, if none remain, starts the finishing hero snake (if any) or ends the draft.
 */
export function applyRochesterPick(state, seat, ref) {
  const order = state.pickOrder ?? []
  if (order[state.turnPos] !== seat) return state // not this seat's turn
  const pack = [...(state.activePack ?? [])]
  const idx = pack.indexOf(ref)
  if (idx === -1) return state // stale — card already taken

  pack.splice(idx, 1)
  const si = String(seat)
  const picks = { ...state.picks, [si]: [...(state.picks[si] ?? []), ref] }

  let next = { ...state, activePack: pack, picks }

  // Still cards in this pack — just advance the snake.
  if (pack.length > 0) {
    next.turnPos = state.turnPos + 1
    next.pickDeadline = freshDeadline(next)
    return next
  }

  // Pack emptied — open the next one if there is one.
  const queue = state.packQueue ?? []
  const playerCount = state.players.length
  if (queue.length > 0) {
    const nextOpener = ((state.opener ?? 0) + 1) % playerCount
    const nextPack = queue[0]
    next = {
      ...next,
      activePack: nextPack,
      packQueue: queue.slice(1),
      opener: nextOpener,
      pickOrder: rochesterOrder(playerCount, nextPack.length, nextOpener),
      turnPos: 0,
      packNum: (state.packNum ?? 1) + 1,
    }
    next.pickDeadline = freshDeadline(next)
    return next
  }

  // All packs drafted (heroes, if any, were drafted first). Draft complete.
  next.phase = 'done'
  next.pickDeadline = null
  return next
}
