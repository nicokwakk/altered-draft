import { getAccessToken } from './reunion.js'

// Frontend client for the Re:Union decks API, via our same-origin Vercel proxy
// (`/api/decks…`) — the real API has no browser CORS. Every call carries the user's
// bearer token. See api/decks/* for the proxy.

async function authHeaders() {
  const token = await getAccessToken()
  if (!token) throw new Error('Not signed in to Re:Union.')
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' }
}

// The authenticated user's decks (summaries). Fetches the whole list (the API paginates
// at 20/page by default) sorted by name, and unwraps the various envelope shapes.
// Each summary carries: id, name, format, isDraft, isPublic, createdAt… (no card list —
// that's only on the per-deck detail endpoint).
export async function listDecks(params = {}) {
  const qs = new URLSearchParams({ itemsPerPage: '1000', 'order[name]': 'asc', ...params }).toString()
  const res = await fetch(`/api/decks?${qs}`, { headers: await authHeaders() })
  if (!res.ok) throw new Error(`Could not load your decks (HTTP ${res.status}).`)
  const data = await res.json()
  for (const key of ['member', 'hydra:member', 'items', 'decks', 'data']) {
    if (Array.isArray(data?.[key])) return data[key]
  }
  return Array.isArray(data) ? data : []
}

// Full deck detail (incl. deckCards) for one id.
export async function getDeck(id) {
  const res = await fetch(`/api/decks/${encodeURIComponent(id)}`, { headers: await authHeaders() })
  if (!res.ok) throw new Error(`Could not load that deck (HTTP ${res.status}).`)
  return res.json()
}

// Create one deck. Returns the API payload ({ id, ... }). Defaults to the API's
// permissive `sandbox` format (valid enum: standard|nuc|singleton|singleton_nuc|sandbox)
// so drafted/opened cards aren't rejected for collection/legality.
export async function createDeck({ name, deckCards, isDraft = false, format = 'sandbox' }) {
  const res = await fetch('/api/decks', {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, format, isPublic: false, isDraft, deckCards }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || data.detail || data.error || `Save failed (HTTP ${res.status}).`)
  return data
}

// Group a ref array → [{ cardReference, quantity }] (the deckCards shape; qty capped at 99).
export function toDeckCards(refs) {
  const counts = {}
  for (const ref of refs) counts[ref] = (counts[ref] ?? 0) + 1
  return Object.entries(counts).map(([cardReference, quantity]) => ({ cardReference, quantity: Math.min(quantity, 99) }))
}

// Expand a deck's API `deckCards` (or `cards`) into a flat ref list (ref repeated by qty).
export function deckCardsToRefs(deck) {
  const cards = deck?.deckCards ?? deck?.cards ?? []
  const refs = []
  for (const c of cards) {
    const ref = String(c.cardReference ?? c.reference ?? '').toUpperCase()
    const qty = Math.max(1, parseInt(c.quantity ?? 1, 10) || 1)
    if (ref) for (let i = 0; i < qty; i++) refs.push(ref)
  }
  return refs
}
