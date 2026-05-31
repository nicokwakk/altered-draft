import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { FACTIONS, FACTION_NAMES, FACTION_COLORS } from '../lib/cardData.js'
import { FACTION_ICONS, RARITY_GEMS, SET_ICONS } from '../lib/assets.js'

// Parse info from reference without any API fetch
// Format: ALT_{SET}_{VARIANT}_{FACTION}_{NUMBER}_{RARITY}
function parseRef(ref) {
  const parts = ref.split('_')
  // ALT | SET | VARIANT | FACTION | NUMBER | RARITY
  // Some sets like COREKS split differently: ALT | CORE | KS | ...
  // Need to handle multi-part set codes
  const set = parts[1] === 'CORE' && parts[2] === 'KS' ? 'COREKS'
    : parts[1] === 'CORE' ? 'CORE'
    : parts[1]

  // Find faction (always 2 letters, one of the known factions)
  const knownFactions = new Set(['AX', 'BR', 'LY', 'MU', 'OR', 'YZ'])
  let faction = '??'
  let rarity = 'C'

  for (let i = 2; i < parts.length; i++) {
    if (knownFactions.has(parts[i])) {
      faction = parts[i]
      rarity = parts[parts.length - 1] // last segment
      break
    }
  }

  // Normalize rarity
  if (rarity === 'E') rarity = 'EX'
  if (rarity === 'R2') rarity = 'R2'

  return { set, faction, rarity, ref }
}

const RARITY_ORDER = { C: 0, R1: 1, R2: 2, EX: 3, U: 4 }
const RARITY_LABELS = { C: 'Common', R1: 'Rare', R2: 'Rare', EX: 'Exalted', U: 'Unique' }

export default function CubePreviewModal({ cube, onClose }) {
  const [search, setSearch] = useState('')
  const [groupBy, setGroupBy] = useState('faction') // 'faction' | 'set' | 'rarity'

  const cards = useMemo(() => cube.refs.map(parseRef), [cube])

  const filtered = useMemo(() => {
    if (!search.trim()) return cards
    const q = search.toLowerCase()
    return cards.filter(c =>
      c.ref.toLowerCase().includes(q) ||
      c.faction.toLowerCase().includes(q) ||
      FACTION_NAMES[c.faction]?.toLowerCase().includes(q) ||
      c.set.toLowerCase().includes(q) ||
      c.rarity.toLowerCase().includes(q)
    )
  }, [cards, search])

  // Stats
  const factionCounts = {}
  const rarityCounts = { C: 0, R1: 0, R2: 0, EX: 0, U: 0 }
  const setCounts = {}
  for (const c of cards) {
    factionCounts[c.faction] = (factionCounts[c.faction] ?? 0) + 1
    if (c.rarity in rarityCounts) rarityCounts[c.rarity]++
    setCounts[c.set] = (setCounts[c.set] ?? 0) + 1
  }

  // Group filtered cards
  function groupCards() {
    if (groupBy === 'faction') {
      const groups = {}
      for (const f of FACTIONS) groups[f] = []
      groups['??'] = []
      for (const c of filtered) (groups[c.faction] ?? groups['??']).push(c)
      return Object.entries(groups).filter(([, v]) => v.length).map(([key, cards]) => ({
        key,
        label: FACTION_NAMES[key] ?? key,
        icon: FACTION_ICONS[key] ?? null,
        colorCls: FACTION_COLORS[key] ?? 'text-gray-400 bg-gray-800 border-gray-700',
        cards: [...cards].sort((a, b) => (RARITY_ORDER[a.rarity] ?? 0) - (RARITY_ORDER[b.rarity] ?? 0)),
      }))
    }
    if (groupBy === 'set') {
      const groups = {}
      for (const c of filtered) {
        if (!groups[c.set]) groups[c.set] = []
        groups[c.set].push(c)
      }
      return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0])).map(([key, cards]) => ({
        key, label: key, icon: SET_ICONS[key] ?? null, colorCls: 'text-gray-300 bg-gray-800 border-gray-700',
        cards: [...cards].sort((a, b) => a.faction.localeCompare(b.faction)),
      }))
    }
    if (groupBy === 'rarity') {
      const order = ['C', 'R1', 'R2', 'EX', 'U']
      const groups = {}
      for (const c of filtered) {
        if (!groups[c.rarity]) groups[c.rarity] = []
        groups[c.rarity].push(c)
      }
      return order.filter(r => groups[r]?.length).map(key => ({
        key, label: RARITY_LABELS[key] ?? key, icon: RARITY_GEMS[key] ?? null, colorCls: 'text-gray-300 bg-gray-800 border-gray-700',
        cards: [...(groups[key] ?? [])].sort((a, b) => a.faction.localeCompare(b.faction)),
      }))
    }
    return []
  }

  const groups = groupCards()

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-gray-900 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-800">
          <div>
            <h2 className="font-bold text-lg">{cube.name}</h2>
            <p className="text-sm text-gray-500">by {cube.author} · {cube.cardCount} cards</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 text-xl leading-none p-1">✕</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar stats */}
          <div className="w-44 border-r border-gray-800 p-4 space-y-4 shrink-0 overflow-y-auto">
            {/* Faction breakdown */}
            <div>
              <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Factions</p>
              <div className="space-y-1.5">
                {FACTIONS.filter(f => factionCounts[f]).map(f => (
                  <div key={f} className="flex items-center gap-1.5">
                    {FACTION_ICONS[f] && <img src={FACTION_ICONS[f]} alt="" className="w-3.5 h-3.5 object-contain shrink-0" />}
                    <span className="text-xs text-gray-300 flex-1">{FACTION_NAMES[f]}</span>
                    <span className="text-xs text-gray-500">{factionCounts[f]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rarity breakdown */}
            <div>
              <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Rarity</p>
              <div className="space-y-1.5">
                {[
                  { key: 'C', label: 'Common' },
                  { key: 'R1', label: 'Rare', merge: 'R2' },
                  { key: 'EX', label: 'Exalted' },
                  { key: 'U', label: 'Unique' },
                ].map(({ key, label, merge }) => {
                  const count = rarityCounts[key] + (merge ? (rarityCounts[merge] ?? 0) : 0)
                  if (!count) return null
                  return (
                    <div key={key} className="flex items-center gap-1.5">
                      {RARITY_GEMS[key] && <img src={RARITY_GEMS[key]} alt="" className="w-3.5 h-3.5 object-contain shrink-0" />}
                      <span className="text-xs text-gray-300 flex-1">{label}</span>
                      <span className="text-xs text-gray-500">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Set breakdown */}
            <div>
              <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Sets</p>
              <div className="space-y-1.5">
                {Object.entries(setCounts).sort((a, b) => b[1] - a[1]).map(([s, count]) => (
                  <div key={s} className="flex items-center gap-1.5">
                    {SET_ICONS[s]
                      ? <img src={SET_ICONS[s]} alt={s} className="w-3.5 h-3.5 object-contain shrink-0" onError={e => { e.currentTarget.style.display = 'none' }} />
                      : <span className="w-3.5 shrink-0" />}
                    <span className="text-xs text-gray-300 flex-1 truncate">{s}</span>
                    <span className="text-xs text-gray-500">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main card list */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Controls */}
            <div className="flex items-center gap-3 p-3 border-b border-gray-800">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by faction, set, rarity…"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500"
              />
              <div className="flex gap-1">
                {['faction', 'set', 'rarity'].map(g => (
                  <button key={g} onClick={() => setGroupBy(g)}
                    className={`px-2.5 py-1.5 rounded text-xs capitalize transition-colors ${groupBy === g
                      ? 'bg-amber-500 text-gray-950 font-bold'
                      : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}>
                    {g}
                  </button>
                ))}
              </div>
              <span className="text-xs text-gray-500 shrink-0">{filtered.length} cards</span>
            </div>

            {/* Card groups */}
            <div className="overflow-y-auto flex-1 p-3 space-y-4">
              {groups.map(group => (
                <div key={group.key}>
                  <div className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded border mb-2 ${group.colorCls}`}>
                    {group.icon && (
                      typeof group.icon === 'string' && group.icon.startsWith('http')
                        ? <img src={group.icon} alt="" className="w-3.5 h-3.5 object-contain" onError={e => { e.currentTarget.style.display = 'none' }} />
                        : null
                    )}
                    {group.label}
                    <span className="opacity-60 ml-0.5">({group.cards.length})</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    {group.cards.map(c => (
                      <div key={c.ref} className="flex items-center gap-1.5 py-0.5 text-xs">
                        {FACTION_ICONS[c.faction] && (
                          <img src={FACTION_ICONS[c.faction]} alt={c.faction} className="w-3 h-3 object-contain shrink-0" />
                        )}
                        <span className="text-gray-400 font-mono truncate flex-1">{c.ref}</span>
                        {RARITY_GEMS[c.rarity] && c.rarity !== 'C' && (
                          <img src={RARITY_GEMS[c.rarity]} alt={c.rarity} className="w-3 h-3 object-contain shrink-0" />
                        )}
                        {SET_ICONS[c.set] && (
                          <img src={SET_ICONS[c.set]} alt={c.set} className="w-3 h-3 object-contain shrink-0 opacity-50"
                            onError={e => { e.currentTarget.style.display = 'none' }} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
