import { useState, useRef } from 'react'
import {
  FACTIONS, FACTION_NAMES, FACTION_COLORS,
  SET_ABBREV, SET_ABBREV_ICON_CODE,
} from '../lib/cardData.js'
import { FACTION_ICONS, RARITY_GEMS, SET_ICONS, setCodeFromRef } from '../lib/assets.js'

const TYPE_LABEL = {
  HERO: 'Hero', CHARACTER: 'Character', SPELL: 'Spell',
  PERMANENT: 'Permanent', LANDMARK_PERMANENT: 'Permanent', EXPEDITION_PERMANENT: 'Permanent',
}
const TYPE_ORDER = ['Hero', 'Character', 'Spell', 'Permanent']

// Default card ordering: heroes first, then Character > Spell > Permanent,
// then hand cost asc, then reserve (recall) cost asc, then name.
const TYPE_RANK = { CHARACTER: 0, SPELL: 1, PERMANENT: 2, LANDMARK_PERMANENT: 2, EXPEDITION_PERMANENT: 2 }
export function cardSorter(cardMap) {
  return (ra, rb) => {
    const a = cardMap[ra], b = cardMap[rb]
    const ah = a?.cardType === 'HERO' ? 0 : 1
    const bh = b?.cardType === 'HERO' ? 0 : 1
    if (ah !== bh) return ah - bh
    const at = TYPE_RANK[a?.cardType] ?? 3, bt = TYPE_RANK[b?.cardType] ?? 3
    if (at !== bt) return at - bt
    const ac = a?.mainCost ?? 99, bc = b?.mainCost ?? 99
    if (ac !== bc) return ac - bc
    const ar = a?.recallCost ?? 99, br = b?.recallCost ?? 99
    if (ar !== br) return ar - br
    return (a?.name ?? '').localeCompare(b?.name ?? '')
  }
}

// Hover-zoom origin: anchor the scale to whichever viewport edge the card is
// near so the enlarged card never spills off-screen. Works at any breakpoint /
// column count because it measures the card's real position on mouseenter.
export const HOVER_SCALE = 1.6
export function useZoomOrigin(scale = HOVER_SCALE) {
  const ref = useRef(null)
  const [origin, setOrigin] = useState('top')
  function onMouseEnter() {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const growX = (r.width * (scale - 1)) / 2   // overflow each side when centered
    const growY = r.height * (scale - 1)         // overflow below when top-anchored
    const vw = window.innerWidth, vh = window.innerHeight
    let x = ''
    if (r.left - growX < 8) x = 'left'
    else if (r.right + growX > vw - 8) x = 'right'
    let y = 'top'
    if (r.bottom + growY > vh - 8 && r.top - growY > 8) y = 'bottom'
    setOrigin(`${y}${x ? ' ' + x : ''}`)
  }
  return { ref, origin, onMouseEnter }
}

/**
 * Shared pool browser with faction filter, sort/group, +/- deck controls,
 * and a large hover preview. Heroes are grouped inside their own faction.
 */
export default function PoolGrid({ refs, cardMap, deck, poolCounts, onAdd, onRemove, loading, flags, onToggleFlag }) {
  const [filterFaction, setFilterFaction] = useState('ALL')
  const [sortBy, setSortBy] = useState('faction')
  const [flaggedOnly, setFlaggedOnly] = useState(false)

  const flagCount = flags ? refs.filter(r => flags.has(r)).length : 0

  let visibleRefs = filterFaction === 'ALL'
    ? refs
    : refs.filter(r => cardMap[r]?.faction === filterFaction)
  if (flaggedOnly && flags) visibleRefs = visibleRefs.filter(r => flags.has(r))

  const cards = visibleRefs.map(r => ({ ref: r, card: cardMap[r] }))

  function buildGroups() {
    if (sortBy === 'faction') {
      const buckets = {}
      for (const f of FACTIONS) buckets[f] = []
      buckets['??'] = []
      for (const { ref, card } of cards) {
        const key = card?.faction ?? '??'
        ;(buckets[key] = buckets[key] ?? []).push(ref)
      }
      return Object.entries(buckets).filter(([, v]) => v.length).map(([key, refs]) => ({
        key, label: FACTION_NAMES[key] ?? key,
        icon: FACTION_ICONS[key] ?? null,
        colorCls: FACTION_COLORS[key] ?? 'text-gray-400 bg-gray-800 border-gray-700',
        refs,
      }))
    }
    if (sortBy === 'type') {
      const buckets = {}
      for (const { ref, card } of cards) {
        const label = TYPE_LABEL[card?.cardType] ?? (card?.cardType ?? '?')
        ;(buckets[label] = buckets[label] ?? []).push(ref)
      }
      return TYPE_ORDER.filter(t => buckets[t]).map(label => ({
        key: label, label, icon: null, colorCls: 'text-gray-300 bg-gray-800 border-gray-700', refs: buckets[label],
      }))
    }
    if (sortBy === 'cost') {
      const heroes = [], buckets = {}
      for (const { ref, card } of cards) {
        if (card?.cardType === 'HERO') { heroes.push(ref); continue }
        const cost = card?.mainCost != null ? String(card.mainCost) : '—'
        ;(buckets[cost] = buckets[cost] ?? []).push(ref)
      }
      const groups = Object.entries(buckets)
        .sort(([a], [b]) => a === '—' ? 1 : b === '—' ? -1 : Number(a) - Number(b))
        .map(([cost, refs]) => ({
          key: cost, label: cost === '—' ? 'No cost' : `Cost ${cost}`, icon: null,
          colorCls: 'text-gray-300 bg-gray-800 border-gray-700', refs,
        }))
      if (heroes.length) groups.unshift({ key: 'HERO', label: 'Hero', icon: null, colorCls: 'text-amber-400 bg-amber-500/10 border-amber-500/30', refs: heroes })
      return groups
    }
    if (sortBy === 'set') {
      const buckets = {}
      for (const { ref } of cards) {
        const rawSet = ref.split('_')[1] ?? '?'
        const abbrev = SET_ABBREV[rawSet] ?? rawSet
        ;(buckets[abbrev] = buckets[abbrev] ?? []).push(ref)
      }
      const setOrder = ['BTG', 'TBF', 'WTM', 'SKY', 'SDU', 'ROC', 'NEJ']
      return Object.entries(buckets)
        .sort(([a], [b]) => (setOrder.indexOf(a) + 1 || 99) - (setOrder.indexOf(b) + 1 || 99))
        .map(([abbrev, refs]) => {
          const iconCode = SET_ABBREV_ICON_CODE[abbrev]
          return { key: abbrev, label: abbrev, icon: iconCode ? SET_ICONS[iconCode] : null, colorCls: 'text-gray-300 bg-gray-800 border-gray-700', refs }
        })
    }
    return []
  }

  const cmp = cardSorter(cardMap)
  const groups = buildGroups().map(g => ({ ...g, refs: [...g.refs].sort(cmp) }))

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Faction filter */}
      <div className="px-4 py-2 border-b border-gray-800 flex gap-1.5 flex-wrap shrink-0 bg-gray-950">
        <button onClick={() => setFilterFaction('ALL')}
          className={`px-2.5 py-1 rounded text-xs transition-colors ${filterFaction === 'ALL' ? 'bg-gray-600 text-gray-100' : 'text-gray-500 hover:text-gray-300'}`}>
          All
        </button>
        {FACTIONS.map(f => (
          <button key={f} onClick={() => setFilterFaction(f === filterFaction ? 'ALL' : f)}
            className={`px-2 py-1 rounded text-xs transition-colors flex items-center gap-1 border ${
              filterFaction === f ? FACTION_COLORS[f] : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            {FACTION_ICONS[f] && <img src={FACTION_ICONS[f]} alt={f} className="w-3 h-3 object-contain" />}
            <span className="hidden sm:inline">{FACTION_NAMES[f]}</span>
            <span className="sm:hidden">{f}</span>
          </button>
        ))}
      </div>

      {/* Sort + count */}
      <div className="px-4 py-2 border-b border-gray-800 flex items-center gap-2 shrink-0 bg-gray-950">
        <span className="text-xs text-gray-500 mr-auto">
          {new Set(visibleRefs).size} unique{visibleRefs.length !== new Set(visibleRefs).size && ` · ${visibleRefs.length} total`}
        </span>
        {onToggleFlag && (
          <button onClick={() => setFlaggedOnly(v => !v)} disabled={!flagCount && !flaggedOnly}
            className={`px-2.5 py-1 rounded text-xs transition-colors flex items-center gap-1 ${
              flaggedOnly ? 'bg-amber-500 text-gray-950 font-bold' : 'bg-gray-800 text-gray-400 hover:text-gray-200 disabled:opacity-40'}`}>
            ⚑ Flagged{flagCount ? ` (${flagCount})` : ''}
          </button>
        )}
        <span className="text-xs text-gray-500">Group by:</span>
        {['faction', 'type', 'cost', 'set'].map(s => (
          <button key={s} onClick={() => setSortBy(s)}
            className={`px-2.5 py-1 rounded text-xs capitalize transition-colors ${sortBy === s ? 'bg-amber-500 text-gray-950 font-bold' : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}>
            {s}
          </button>
        ))}
      </div>

      {/* Grouped grid — generous padding + stable gutter so zoom never reflows the page */}
      <div className="overflow-y-auto flex-1 px-8 pt-8 pb-40 space-y-6" style={{ scrollbarGutter: 'stable' }}>
        {groups.map(group => (
          <div key={group.key}>
            <div className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded border mb-2 ${group.colorCls}`}>
              {group.icon && <img src={group.icon} alt="" className="w-3.5 h-3.5 object-contain" onError={e => { e.currentTarget.style.display = 'none' }} />}
              {group.label} <span className="opacity-60">({new Set(group.refs).size})</span>
            </div>
            <CardGridInner refs={group.refs} cardMap={cardMap} loading={loading}
              deck={deck} poolCounts={poolCounts} onAdd={onAdd} onRemove={onRemove}
              flags={flags} onToggleFlag={onToggleFlag} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Self-contained card grid (no filter/sort controls). */
export function SimpleCardGrid({ refs, cardMap, loading, deck, poolCounts, onAdd, onRemove, flags, onToggleFlag }) {
  return (
    <CardGridInner refs={refs} cardMap={cardMap} loading={loading}
      deck={deck} poolCounts={poolCounts} onAdd={onAdd} onRemove={onRemove}
      flags={flags} onToggleFlag={onToggleFlag} />
  )
}

function CardGridInner({ refs, cardMap, loading, deck, poolCounts, onAdd, onRemove, flags, onToggleFlag }) {
  const seen = new Map()
  for (const ref of refs) seen.set(ref, (seen.get(ref) ?? 0) + 1)
  const unique = [...seen.entries()]

  return (
    <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
      {unique.map(([ref, occurrences]) => (
        <PoolCard key={ref} ref_={ref} occurrences={occurrences} card={cardMap[ref]}
          loading={loading} deck={deck} poolCounts={poolCounts} onAdd={onAdd} onRemove={onRemove}
          flagged={flags?.has(ref)} onToggleFlag={onToggleFlag} />
      ))}
    </div>
  )
}

function PoolCard({ ref_, occurrences, card, loading, deck, poolCounts, onAdd, onRemove, flagged, onToggleFlag }) {
  const { ref, origin, onMouseEnter } = useZoomOrigin()
  const poolQty = poolCounts ? (poolCounts[ref_] ?? occurrences) : occurrences
  const inDeck = deck?.[ref_] ?? 0
  const canAdd = inDeck < poolQty
  const canRemove = inDeck > 0
  const setIcon = SET_ICONS[setCodeFromRef(ref_)]

  return (
    <div className={`relative flex flex-col rounded-lg border bg-gray-900 ${flagged ? 'border-amber-400 ring-1 ring-amber-400/60' : 'border-gray-700'}`}>
      <div ref={ref} onMouseEnter={onMouseEnter} style={{ transformOrigin: origin }}
        className="aspect-[2/3] bg-gray-800 overflow-hidden rounded-t-lg relative cursor-zoom-in
        transition-transform duration-150 ease-out hover:scale-[1.6] hover:z-30 hover:shadow-xl hover:shadow-black/70">
        {card?.imagePath ? (
          <img src={card.imagePath} alt={card?.name} className="w-full h-full object-cover" loading="lazy"
            onError={e => { e.currentTarget.style.display = 'none' }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-1">
            <span className="text-xs text-gray-600 text-center leading-tight">{loading ? '…' : (card?.name ?? ref_)}</span>
          </div>
        )}
        {poolQty > 1 && (
          <div className="absolute top-1 left-1 bg-gray-900/90 text-gray-300 font-bold text-xs px-1.5 py-0.5 rounded border border-gray-600">
            ×{poolQty}
          </div>
        )}
        {inDeck > 0 && (
          <div className="absolute top-1 right-1 bg-amber-500 text-gray-950 font-bold text-xs px-1.5 py-0.5 rounded">
            {inDeck} in deck
          </div>
        )}
      </div>
      {/* Footer: name + controls (never overlaps the art) */}
      <div className="p-1">
        <p className="text-xs text-gray-300 leading-tight line-clamp-1">{card?.name ?? ''}</p>
        <div className="flex items-center gap-1 mt-1">
          <button onClick={() => onRemove(ref_)} disabled={!canRemove}
            className="w-5 h-5 rounded bg-gray-800 hover:bg-red-800 disabled:opacity-25 text-white font-bold flex items-center justify-center text-sm leading-none transition-colors">
            −
          </button>
          <span className={`w-4 text-center text-xs font-bold ${inDeck > 0 ? 'text-amber-400' : 'text-gray-500'}`}>{inDeck}</span>
          <button onClick={() => onAdd(ref_)} disabled={!canAdd}
            className="w-5 h-5 rounded bg-gray-800 hover:bg-green-800 disabled:opacity-25 text-white font-bold flex items-center justify-center text-sm leading-none transition-colors">
            +
          </button>
          <span className="ml-auto flex items-center gap-1.5">
            {card?.cardType !== 'HERO' && RARITY_GEMS[card?.rarity] && <img src={RARITY_GEMS[card.rarity]} alt="" className="w-3 h-3 object-contain" />}
            {setIcon && <img src={setIcon} alt="" className="w-3 h-3 object-contain opacity-50" onError={e => { e.currentTarget.style.display = 'none' }} />}
            {onToggleFlag && (
              <button onClick={() => onToggleFlag(ref_)} title={flagged ? 'Unflag' : 'Flag for later'}
                className={`text-sm leading-none transition-colors ${flagged ? 'text-amber-400' : 'text-gray-600 hover:text-gray-300'}`}>
                {flagged ? '⚑' : '⚐'}
              </button>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}
