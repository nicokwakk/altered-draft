import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../auth/AuthProvider.jsx'
import { createDeck, toDeckCards } from '../lib/decks.js'

const DECKBUILDER = 'https://deckbuilder.alteredcore.org/decks'

// DDMM for saved-deck names (e.g. 1706).
function ddmm() {
  const d = new Date()
  return String(d.getDate()).padStart(2, '0') + String(d.getMonth() + 1).padStart(2, '0')
}

async function copyText(text) {
  if (!text) return false
  try { await navigator.clipboard.writeText(text); return true }
  catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
      return true
    } catch { return false }
  }
}

// One dropdown for both copying card lists (altered.re format) and saving to Re:Union —
// replaces the separate copy + save buttons on Results & Sealed. `format` is the human
// label ("Draft" | "Sealed") woven into saved deck names, e.g. "AB12 · Draft deck · 1706".
export default function ExportMenu({ poolRefs, deckRefs, poolDecklist, deckDecklist, name, format = 'Draft' }) {
  const { user, login } = useAuth()
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [saving, setSaving] = useState(null) // 'pool' | 'deck' | null
  const [saved, setSaved] = useState({})     // { pool?, deck?, poolErr?, deckErr? }
  const box = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = e => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const hasDeck = deckRefs?.length > 0

  async function copy(text, label) {
    const ok = await copyText(text)
    setToast(ok ? `${label} copied ✓` : 'Copy failed')
    setTimeout(() => setToast(''), 2000)
  }

  async function save(kind) {
    const refs = kind === 'pool' ? poolRefs : deckRefs
    if (!refs?.length) return
    setSaving(kind)
    setSaved(s => ({ ...s, [kind]: undefined, [`${kind}Err`]: undefined }))
    try {
      const deckName = `${name} · ${format} ${kind} · ${ddmm()}`
      const { id } = await createDeck({ name: deckName, deckCards: toDeckCards(refs), isDraft: kind === 'pool', format: 'sandbox' })
      setSaved(s => ({ ...s, [kind]: id }))
    } catch (e) {
      setSaved(s => ({ ...s, [`${kind}Err`]: e.message }))
    }
    setSaving(null)
  }

  const item = 'w-full flex items-center justify-between gap-3 text-left px-3 py-2 text-sm rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <div className="relative" ref={box}>
      <button onClick={() => setOpen(o => !o)}
        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-gray-950 font-medium text-sm rounded-lg transition-colors flex items-center gap-1.5">
        Export / Save <span className="text-xs">▾</span>
      </button>
      {toast && !open && <span className="absolute right-0 top-full mt-1 text-xs text-green-400 whitespace-nowrap">{toast}</span>}

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-2 z-50 space-y-0.5">
          <p className="px-3 pt-1 pb-1.5 text-xs uppercase tracking-widest text-gray-500">Copy for altered.re {toast && <span className="text-green-400 normal-case tracking-normal ml-1">{toast}</span>}</p>
          <button className={`${item} hover:bg-gray-800 text-gray-200`} onClick={() => copy(poolDecklist, 'Card list')} disabled={!poolDecklist}>
            <span>Copy complete card list</span>
            <span className="text-xs text-gray-500">{poolRefs?.length ?? 0}</span>
          </button>
          <button className={`${item} hover:bg-gray-800 text-gray-200`} onClick={() => copy(deckDecklist, 'Decklist')} disabled={!hasDeck}>
            <span>Copy decklist</span>
            <span className="text-xs text-gray-500">{deckRefs?.length ?? 0}</span>
          </button>

          <div className="h-px bg-gray-800 my-1.5" />
          <p className="px-3 pb-1.5 text-xs uppercase tracking-widest text-gray-500">Save to Re:Union</p>

          {!user ? (
            <button className={`${item} hover:bg-gray-800 text-amber-400`} onClick={() => login()}>
              Connect Re:Union to save
            </button>
          ) : (
            <>
              <button className={`${item} hover:bg-gray-800 text-gray-200`} onClick={() => save('pool')} disabled={saving === 'pool' || !poolRefs?.length}>
                <span>{saving === 'pool' ? 'Saving…' : 'Save your pulls to Re:Union'}</span>
                {saved.pool ? <a href={`${DECKBUILDER}/${saved.pool}`} target="_blank" rel="noopener noreferrer" className="text-xs text-green-400 hover:underline" onClick={e => e.stopPropagation()}>open ↗</a>
                  : saved.poolErr ? <span className="text-xs text-red-400" title={saved.poolErr}>failed</span> : null}
              </button>
              <button className={`${item} hover:bg-gray-800 text-gray-200`} onClick={() => save('deck')} disabled={saving === 'deck' || !hasDeck}>
                <span>{saving === 'deck' ? 'Saving…' : 'Save your deck to Re:Union'}</span>
                {saved.deck ? <a href={`${DECKBUILDER}/${saved.deck}`} target="_blank" rel="noopener noreferrer" className="text-xs text-green-400 hover:underline" onClick={e => e.stopPropagation()}>open ↗</a>
                  : saved.deckErr ? <span className="text-xs text-red-400" title={saved.deckErr}>failed</span> : null}
              </button>
              <p className="px-3 pt-1 text-xs text-gray-600">Saved as sandbox decks under {user.pseudo}.</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
