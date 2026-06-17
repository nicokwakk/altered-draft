/**
 * Winston draft — pure state transitions (immutable updates). 2-player only.
 *
 * Setup: the whole pool is shuffled into a face-down `deck`; three small `piles` are seeded
 * with one card each. On your turn you look at pile 1: TAKE it (into your pool, then refill
 * that pile from the deck) or DECLINE (add a face-down card from the deck to it and move to
 * the next pile). Decline all three and you draw the top of the deck blind. Turn then passes.
 *
 * **Hidden information → honor system (the UI MUST enforce it):** the piles live in shared
 * room state, so the renderer must only ever reveal `piles[peekIndex]` to the player whose
 * turn it is, and show every other pile (and to the waiting player, ALL piles) face-down as
 * counts only. Cheating then requires inspecting raw network/state, not the UI.
 *
 * State (phase: 'winston'): deck (draw pile), piles ([[refs] × 3]), turn (0|1), peekIndex
 * (0..2, which pile the active player is currently looking at), picks, plus the usual
 * config/players/version/pickDeadline. Optional finishing hero snake (heroMode='draft').
 */

import { makeDeadline } from '../components/PickTimer.jsx'
import { heroOrderFor } from './draftLogic.js'

function freshDeadline(state) {
  const seconds = state.config?.timerSeconds
  if (!state.config?.timerEnabled || !seconds) return null
  return makeDeadline(seconds)
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const PILE_COUNT = 3

function nextNonEmpty(piles, from) {
  for (let k = from; k < piles.length; k++) if (piles[k].length) return k
  return -1
}

export function buildWinstonState(config, players, allPacks, heroPool = null) {
  const pool = shuffle((allPacks ?? []).flat().filter(Boolean))
  const piles = []
  for (let k = 0; k < PILE_COUNT; k++) piles.push(pool.length ? [pool.pop()] : [])
  const deck = pool // the rest is the face-down draw pile

  const state = {
    config,
    players,
    phase: 'winston',
    deck,
    piles,
    turn: 0,
    peekIndex: 0,
    picks: { '0': [], '1': [] },
    pickDeadline: null,
    version: 0,
  }

  if (heroPool && heroPool.length) {
    const ht = Math.min(2, Math.floor(heroPool.length / players.length)) // 2 players
    state.heroPool = heroPool
    state.heroTarget = Math.max(0, ht)
    state.heroPassesDone = 0
    state.heroPicks = { '0': [], '1': [] }
  }

  state.pickDeadline = freshDeadline(state)
  return state
}

// Reached when the deck is empty and every pile is empty: either finish, or (heroMode='draft')
// run the finishing hero snake first.
function finishOrHero(next) {
  const drained = next.deck.length === 0 && next.piles.every(p => !p.length)
  if (!drained) return next
  const needHero = next.heroPool && next.heroPool.length >= next.players.length
    && (next.heroPassesDone ?? 0) < (next.heroTarget ?? 0)
  if (needHero) {
    next.phase = 'heroDraft'
    next.heroFinish = true
    next.heroOrder = heroOrderFor(next.players.length, next.heroPassesDone ?? 0)
    next.heroTurnPos = 0
    next.pickDeadline = freshDeadline(next)
  } else {
    next.phase = 'done'
    next.pickDeadline = null
  }
  return next
}

/**
 * Apply a Winston action ('take' | 'decline') for `seat`. Only the player whose turn it is may
 * act. Returns a new state (or the same state if the move is illegal / stale).
 */
export function applyWinstonAction(state, seat, action) {
  if (state.phase !== 'winston' || state.turn !== seat) return state

  const other = seat === 0 ? 1 : 0
  const deck = [...state.deck]
  const piles = state.piles.map(p => [...p])
  const picks = { ...state.picks }
  const seatPicks = [...(picks[String(seat)] ?? [])]

  // Normalize to the pile actually in front of the player (skip emptied slots — only possible
  // once the deck has run dry).
  let i = state.peekIndex
  if (!piles[i]?.length) {
    const ni = nextNonEmpty(piles, i)
    i = ni === -1 ? i : ni
  }

  const passTurn = () => finishOrHero({
    ...state, deck, piles,
    picks: { ...picks, [String(seat)]: seatPicks },
    turn: other, peekIndex: 0, pickDeadline: freshDeadline(state),
  })
  const sameTurn = (peekIndex) => finishOrHero({
    ...state, deck, piles,
    picks: { ...picks, [String(seat)]: seatPicks },
    peekIndex, pickDeadline: state.pickDeadline,
  })

  if (action === 'take') {
    if (piles[i]?.length) {
      seatPicks.push(...piles[i])
      piles[i] = deck.length ? [deck.pop()] : []
    }
    return passTurn()
  }

  // decline
  if (deck.length) {
    // Grow the current pile with a face-down card, then move on.
    piles[i].push(deck.pop())
    if (i < PILE_COUNT - 1) return sameTurn(i + 1)
    // Declined all three → draw the top of the deck blind (if any left after growing).
    if (deck.length) seatPicks.push(deck.pop())
    return passTurn()
  }

  // Deck is empty: declining can't add a card. Move to the next non-empty pile; if there is
  // none, the player must take the current pile (guarantees the draft makes progress / ends).
  const ni = nextNonEmpty(piles, i + 1)
  if (ni !== -1) return sameTurn(ni)
  if (piles[i]?.length) { seatPicks.push(...piles[i]); piles[i] = [] }
  return passTurn()
}
