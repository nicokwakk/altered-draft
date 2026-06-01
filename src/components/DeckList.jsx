import { FACTIONS, FACTION_NAMES, FACTION_COLORS } from '../lib/cardData.js'
import { FACTION_ICONS, RARITY_GEMS } from '../lib/assets.js'

/**
 * Deck list grouped by faction (heroes shown inside their faction, at top).
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
    <div className="space-y-4 max-w-2xl mx-auto">
      {[...FACTIONS, '??'].filter(k => groups[k]).map(key => {
        const factionCls = FACTION_COLORS[key] ?? 'text-gray-300 bg-gray-800 border-gray-700'
        const total = groups[key].reduce((a, { qty }) => a + qty, 0)
        return (
          <div key={key}>
            <div className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded border mb-2 ${factionCls}`}>
              {FACTION_ICONS[key] && <img src={FACTION_ICONS[key]} alt="" className="w-3.5 h-3.5 object-contain" />}
              {FACTION_NAMES[key] ?? key} <span className="opacity-60">({total})</span>
            </div>
            <div className="space-y-1">
              {groups[key]
                // heroes first, then alphabetical
                .sort((a, b) => {
                  const ah = a.card?.cardType === 'HERO' ? 0 : 1
                  const bh = b.card?.cardType === 'HERO' ? 0 : 1
                  if (ah !== bh) return ah - bh
                  return (a.card?.name ?? '').localeCompare(b.card?.name ?? '')
                })
                .map(({ ref, qty, card }) => (
                  <div key={ref} className="flex items-center gap-2 py-0.5">
                    <span className="w-6 text-center text-amber-400 font-bold text-sm shrink-0">{qty}</span>
                    <span className="text-gray-300 text-sm flex-1 truncate">
                      {card?.name ?? ref}
                      {card?.cardType === 'HERO' && <span className="text-amber-500 text-xs ml-1.5">(Hero)</span>}
                    </span>
                    {card?.cardType !== 'HERO' && RARITY_GEMS[card?.rarity] && (
                      <img src={RARITY_GEMS[card.rarity]} alt="" className="w-3.5 h-3.5 object-contain shrink-0" />
                    )}
                    <button onClick={() => onRemove(ref)}
                      className="w-6 h-6 rounded bg-gray-800 hover:bg-red-900/50 text-gray-400 hover:text-red-400 flex items-center justify-center text-sm shrink-0 transition-colors">
                      −
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
