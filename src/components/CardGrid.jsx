import { FACTION_ICONS, RARITY_GEMS } from '../lib/assets.js'
import { FACTION_NAMES } from '../lib/cardData.js'

export default function CardGrid({ packRefs, cardMap, onPick, onHover, disabled }) {
  if (!packRefs?.length) {
    return <div className="text-gray-600 text-sm">No cards in this pack.</div>
  }

  return (
    <div className="grid grid-cols-6 gap-2">
      {packRefs.map(ref => {
        const card = cardMap[ref]
        const faction = card?.faction ?? 'XX'
        const rarity = card?.rarity ?? 'C'
        const factionIcon = FACTION_ICONS[faction]
        const rarityGem = RARITY_GEMS[rarity]

        return (
          <button
            key={ref}
            onClick={() => !disabled && onPick(ref)}
            onMouseEnter={() => onHover(card ?? { reference: ref, name: ref })}
            onMouseLeave={() => onHover(null)}
            disabled={disabled}
            className={`
              relative flex flex-col rounded-lg overflow-hidden border border-gray-700
              bg-gray-900 text-left transition-all duration-150
              ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-amber-500 hover:shadow-lg hover:shadow-amber-500/10 hover:scale-105 cursor-pointer'}
            `}
          >
            {/* Card image */}
            <div className="aspect-[2/3] bg-gray-800 flex items-center justify-center overflow-hidden">
              {card?.imagePath ? (
                <img
                  src={card.imagePath}
                  alt={card.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={e => { e.currentTarget.style.display = 'none' }}
                />
              ) : (
                <div className="text-gray-600 text-xs px-2 text-center break-all">{card?.name ?? ref}</div>
              )}
            </div>

            {/* Card info bar */}
            <div className="p-1.5 space-y-1">
              <p className="text-xs font-medium leading-tight line-clamp-1 text-gray-200">
                {card?.name ?? ref}
              </p>
              <div className="flex items-center gap-1">
                {factionIcon ? (
                  <img src={factionIcon} alt={FACTION_NAMES[faction] ?? faction}
                    className="w-4 h-4 object-contain shrink-0"
                    onError={e => { e.currentTarget.style.display = 'none' }} />
                ) : (
                  <span className="text-xs text-gray-500 font-mono">{faction}</span>
                )}
                {rarityGem && card?.cardType !== 'HERO' ? (
                  <img src={rarityGem} alt={rarity}
                    className="w-4 h-4 object-contain ml-auto shrink-0"
                    onError={e => { e.currentTarget.style.display = 'none' }} />
                ) : null}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
