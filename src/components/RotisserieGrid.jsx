import { useState } from 'react'
import { FACTIONS, FACTION_NAMES, FACTION_COLORS } from '../lib/cardData.js'
import { FACTION_ICONS, RARITY_GEMS } from '../lib/assets.js'
import { cardSorter } from './PoolGrid.jsx'

// The shared Rotisserie pool: every draftable card face-up. Deduped with an ×N count (a cube
// can hold several copies), faction-filtered, and sorted like the deckbuilder. Clicking a card
// drafts ONE copy — only enabled on your turn. Distinct from CardGrid (which keys by ref and so
// can't show a pool with duplicates) and PoolGrid (deckbuild +/- controls).
export default function RotisserieGrid({ refs, cardMap, onPick, onHover, disabled }) {
  const [filterFaction, setFilterFaction] = useState('ALL')

  if (!refs?.length) return <div className="text-faint text-sm">The pool is empty.</div>

  const counts = new Map()
  for (const r of refs) counts.set(r, (counts.get(r) ?? 0) + 1)
  let unique = [...counts.keys()]
  if (filterFaction !== 'ALL') unique = unique.filter(r => cardMap[r]?.faction === filterFaction)
  unique.sort(cardSorter(cardMap))

  return (
    <div>
      {/* Faction filter */}
      <div className="flex gap-1.5 flex-wrap mb-3">
        <button onClick={() => setFilterFaction('ALL')}
          className={`px-2.5 py-1 rounded text-xs transition-colors ${filterFaction === 'ALL' ? 'bg-surface3 text-ink' : 'text-faint hover:text-ink2'}`}>
          All
        </button>
        {FACTIONS.map(f => (
          <button key={f} onClick={() => setFilterFaction(f === filterFaction ? 'ALL' : f)}
            className={`px-2 py-1 rounded text-xs transition-colors flex items-center gap-1 border ${
              filterFaction === f ? FACTION_COLORS[f] : 'border-transparent text-faint hover:text-ink2'}`}>
            {FACTION_ICONS[f] && <img src={FACTION_ICONS[f]} alt={f} className="w-3 h-3 object-contain" />}
            <span className="hidden sm:inline">{FACTION_NAMES[f]}</span>
            <span className="sm:hidden">{f}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
        {unique.map(ref => {
          const card = cardMap[ref]
          const faction = card?.faction ?? 'XX'
          const rarity = card?.rarity ?? 'C'
          const n = counts.get(ref)
          return (
            <button key={ref}
              onClick={() => !disabled && onPick(ref)}
              onMouseEnter={() => onHover?.(card ?? { reference: ref, name: ref })}
              onMouseLeave={() => onHover?.(null)}
              disabled={disabled}
              className={`relative flex flex-col rounded-lg overflow-hidden border border-line bg-surface text-left transition-all duration-150 ${
                disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-accent hover:shadow-lg hover:shadow-accent/10 hover:scale-105 cursor-pointer'}`}>
              <div className="aspect-[2/3] bg-surface2 flex items-center justify-center overflow-hidden relative">
                {card?.imagePath ? (
                  <img src={card.imagePath} alt={card.name} className="w-full h-full object-cover" loading="lazy"
                    onError={e => { e.currentTarget.style.display = 'none' }} />
                ) : (
                  <div className="text-faint text-xs px-2 text-center break-all">{card?.name ?? ref}</div>
                )}
                {n > 1 && (
                  <div className="absolute top-1 left-1 bg-surface/90 text-ink2 font-bold text-xs px-1.5 py-0.5 rounded border border-line">×{n}</div>
                )}
              </div>
              <div className="p-1.5 space-y-1">
                <p className="text-xs font-medium leading-tight line-clamp-1 text-ink">{card?.name ?? ref}</p>
                <div className="flex items-center gap-1">
                  {FACTION_ICONS[faction] ? (
                    <img src={FACTION_ICONS[faction]} alt={FACTION_NAMES[faction] ?? faction}
                      className="w-4 h-4 object-contain shrink-0" onError={e => { e.currentTarget.style.display = 'none' }} />
                  ) : (
                    <span className="text-xs text-faint font-mono">{faction}</span>
                  )}
                  {RARITY_GEMS[rarity] && card?.cardType !== 'HERO' && (
                    <img src={RARITY_GEMS[rarity]} alt={rarity} className="w-3.5 h-3.5 object-contain" />
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
