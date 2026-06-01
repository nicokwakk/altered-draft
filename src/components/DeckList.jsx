import { FACTIONS, FACTION_NAMES, FACTION_COLORS } from '../lib/cardData.js'
import { FACTION_ICONS, RARITY_GEMS } from '../lib/assets.js'
import { cardSorter } from './PoolGrid.jsx'

/**
 * Deck shown as a grid of card images, grouped by faction
 * (heroes inside their faction, at top). Click − to remove a copy.
 */
export default function DeckList({ deck, cardMap, onRemove, onAdd, poolCounts }) {
  const groups = {}
  for (const [ref, qty] of Object.entries(deck)) {
    const card = cardMap[ref]
    const key = card?.faction ?? '??'
    if (!groups[key]) groups[key] = []
    groups[key].push({ ref, qty, card })
  }

  return (
    <div className="space-y-6 px-4 pt-4 pb-40">
      {[...FACTIONS, '??'].filter(k => groups[k]).map(key => {
        const factionCls = FACTION_COLORS[key] ?? 'text-gray-300 bg-gray-800 border-gray-700'
        const total = groups[key].reduce((a, { qty }) => a + qty, 0)
        const cmp = cardSorter(cardMap)
        const sorted = groups[key].sort((a, b) => cmp(a.ref, b.ref))
        return (
          <div key={key}>
            <div className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded border mb-2 ${factionCls}`}>
              {FACTION_ICONS[key] && <img src={FACTION_ICONS[key]} alt="" className="w-3.5 h-3.5 object-contain" />}
              {FACTION_NAMES[key] ?? key} <span className="opacity-60">({total})</span>
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
              {sorted.map(({ ref, qty, card }) => (
                <div key={ref} className="relative flex flex-col rounded-lg border border-gray-700 bg-gray-900">
                  <div className="aspect-[2/3] bg-gray-800 overflow-hidden rounded-t-lg relative cursor-zoom-in
                    transition-transform duration-150 ease-out origin-top hover:scale-[1.6] hover:z-30 hover:shadow-xl hover:shadow-black/70">
                    {card?.imagePath ? (
                      <img src={card.imagePath} alt={card?.name} className="w-full h-full object-cover" loading="lazy"
                        onError={e => { e.currentTarget.style.display = 'none' }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center p-1">
                        <span className="text-xs text-gray-600 text-center leading-tight">{card?.name ?? ref}</span>
                      </div>
                    )}
                  </div>
                  {/* Footer: name + qty controls (never overlaps the art) */}
                  <div className="p-1">
                    <p className="text-xs text-gray-300 leading-tight line-clamp-1">{card?.name ?? ''}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <button onClick={() => onRemove(ref)}
                        className="w-5 h-5 rounded bg-gray-800 hover:bg-red-800 text-white font-bold flex items-center justify-center text-sm leading-none transition-colors">
                        −
                      </button>
                      <span className="w-4 text-center text-xs font-bold text-amber-400">{qty}</span>
                      {onAdd && (
                        <button onClick={() => onAdd(ref)} disabled={poolCounts && qty >= (poolCounts[ref] ?? qty)}
                          className="w-5 h-5 rounded bg-gray-800 hover:bg-green-800 disabled:opacity-25 text-white font-bold flex items-center justify-center text-sm leading-none transition-colors">
                          +
                        </button>
                      )}
                      <span className="ml-auto flex items-center gap-1">
                        {card?.cardType !== 'HERO' && RARITY_GEMS[card?.rarity] && <img src={RARITY_GEMS[card.rarity]} alt="" className="w-3 h-3 object-contain" />}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
