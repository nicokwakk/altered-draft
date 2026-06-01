import { useState, useEffect } from 'react'

/**
 * Personal card flags ("mark for later review"), persisted per room + player
 * in localStorage. Not synced — purely a private scratchpad.
 * @returns {{ flags: Set<string>, toggleFlag: (ref:string)=>void, clearFlags: ()=>void }}
 */
export function useCardFlags(code, playerId) {
  const key = code && playerId ? `flags_${code}_${playerId}` : null
  const [flags, setFlags] = useState(() => new Set())

  useEffect(() => {
    if (!key) { setFlags(new Set()); return }
    try {
      const raw = localStorage.getItem(key)
      setFlags(new Set(raw ? JSON.parse(raw) : []))
    } catch { setFlags(new Set()) }
  }, [key])

  function persist(next) {
    if (key) localStorage.setItem(key, JSON.stringify([...next]))
  }

  function toggleFlag(ref) {
    setFlags(prev => {
      const next = new Set(prev)
      if (next.has(ref)) next.delete(ref)
      else next.add(ref)
      persist(next)
      return next
    })
  }

  function clearFlags() {
    setFlags(() => { persist(new Set()); return new Set() })
  }

  return { flags, toggleFlag, clearFlags }
}
