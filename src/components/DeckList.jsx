import { FACTIONS, FACTION_NAMES, FACTION_COLORS } from '../lib/cardData.js'
import { FACTION_ICONS, RARITY_GEMS } from '../lib/assets.js'

/**
 * Deck shown as a grid of card images, grouped by faction
 * (heroes inside their faction, at top). Click − to remove a copy.
 */
export default function DeckList({ deck, cardMap, onRemove }) {
  const groups = {}
  for (const [ref, qty] of Object.entries(deck)) {
    const card = cardMap[ref]
    const key = card?.faction ?? '??'
    if (!groups[key]) groups[key] = []
    groups[key].push({ ref, qty, card })
  }

  return (
    <div className="space-y-5">
      {[...FACTIONS, '??'].filter(k => groups[k]).map(key => {
        const factionCls = FACTION_COLORS[key] ?? 'text-gray-300 bg-gray-800 border-gray-700'
        const total = groups[key].reduce((a, { qty }) => a + qty, 0)
        const sorted = groups[key].sort((a, b) => {
          const ah = a.card?.cardType === 'HERO' ? 0 : 1
          const bh = b.card?.cardType === 'HERO' ? 0 : 1
          if (ah !== bh) return ah - bh
          return (a.card?.name ?? '').localeCompare(b.card?.name ?? '')
        })
        return (
          <div key={key}>
            <div className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded border mb-2 ${factionCls}`}>
              {FACTION_ICONS[key] && <img src={FACTION_ICONS[key]} alt="" className="w-3.5 h-3.5 object-contain" />}
              {FACTION_NAMES[key] ?? key} <span className="opacity-60">({total})</span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 gap-2">
              {sorted.map(({ ref, qty, card }) => (
                <div key={ref} className="relative flex flex-col rounded-lg overflow-hidden border border-gray-700 bg-gray-900 group
                  transition-transform duration-150 ease-out hover:scale-[1.8] hover:z-30 hover:border-amber-500 hover:shadow-xl hover:shadow-black/60">
                  <div className="aspect-[2/3] bg-gray-800 overflow-hidden relative">
                    {card?.imagePath ? (
                      <img src={card.imagePath} alt={card?.name} className="w-full h-full object-cover" loading="lazy"
                        onError={e => { e.currentTarget.style.display = 'none' }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center p-1">
                        <span className="text-xs text-gray-600 text-center leading-tight">{card?.name ?? ref}</span>
                      </div>
                    )}
                    {/* Quantity badge */}
                    {qty > 1 && (
                      <div className="absolute top-1 left-1 bg-amber-500 text-gray-950 font-bold text-xs px-1.5 py-0.5 rounded">
                        ×{qty}
                      </div>
                    )}
                    {/* Remove control */}
                    <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center px-1 py-1.5 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onRemove(ref)}
                        className="w-7 h-7 rounded bg-gray-700 hover:bg-red-800 text-white font-bold flex items-center justify-center transition-colors">
                        −
                      </button>
                    </div>
                  </div>
                  <div className="p-1">
                    <p className="text-xs text-gray-300 leading-tight line-clamp-1">{card?.name ?? ''}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {FACTION_ICONS[card?.faction] && <img src={FACTION_ICONS[card.faction]} alt="" className="w-3 h-3 object-contain" />}
                      {card?.cardType !== 'HERO' && RARITY_GEMS[card?.rarity] && <img src={RARITY_GEMS[card.rarity]} alt="" className="w-3 h-3 object-contain ml-auto" />}
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
