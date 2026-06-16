import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider.jsx'
import { createDeck, toDeckCards } from '../lib/decks.js'

const DECKBUILDER = 'https://deckbuilder.alteredcore.org/decks'

// Saves the drafted/opened pool and the built deck to the user's Re:Union account.
// The pool is stored as isDraft (it isn't a legal deck); the deck as a normal deck.
// Logged out → a Connect button. Used on Results and Sealed.
export default function SaveToReunion({ poolRefs, deckRefs, name }) {
  const { user, login } = useAuth()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null) // { pool?, deck?, poolErr?, deckErr? }

  if (!user) {
    return (
      <button onClick={() => login()}
        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-sm rounded-lg text-gray-300 transition-colors">
        Connect Re:Union
      </button>
    )
  }

  async function save() {
    setBusy(true); setResult(null)
    const out = {}
    if (poolRefs?.length) {
      try { out.pool = (await createDeck({ name: `${name} · pool`, deckCards: toDeckCards(poolRefs), isDraft: true })).id }
      catch (e) { out.poolErr = e.message }
    }
    if (deckRefs?.length) {
      try { out.deck = (await createDeck({ name: `${name} · deck`, deckCards: toDeckCards(deckRefs), isDraft: false })).id }
      catch (e) { out.deckErr = e.message }
    }
    setResult(out); setBusy(false)
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={save} disabled={busy}
        className="px-3 py-1.5 bg-amber-500/90 hover:bg-amber-400 text-gray-950 font-medium text-sm rounded-lg disabled:opacity-50 transition-colors">
        {busy ? 'Saving…' : 'Save to Re:Union'}
      </button>
      {result && (
        <span className="text-xs flex items-center gap-2">
          {result.pool && <a href={`${DECKBUILDER}/${result.pool}`} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">pool ↗</a>}
          {result.deck && <a href={`${DECKBUILDER}/${result.deck}`} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">deck ↗</a>}
          {(result.poolErr || result.deckErr) && <span className="text-red-400" title={result.poolErr || result.deckErr}>save failed</span>}
        </span>
      )}
    </div>
  )
}
