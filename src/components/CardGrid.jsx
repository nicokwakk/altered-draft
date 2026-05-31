import { FACTION_COLORS, FACTION_NAMES } from '../lib/cardData.js'

const RARITY_BADGE = {
  C:  { label: 'C',  cls: 'bg-gray-700 text-gray-300' },
  U:  { label: 'U',  cls: 'bg-yellow-600 text-yellow-100' },
  R1: { label: 'R',  cls: 'bg-purple-700 text-purple-100' },
  R2: { label: 'R',  cls: 'bg-purple-700 text-purple-100' },
}

export default function CardGrid({ packRefs, cardMap, onPick, onHover, disabled }) {
  if (!packRefs?.length) {
    return <div className="text-gray-600 text-sm">No cards in this pack.</div>
  }

  return (
    <div className="grid grid-cols-5 gap-2">
      {packRefs.map(ref => {
        const card = cardMap[ref]
        const rarity = RARITY_BADGE[card?.rarity] ?? RARITY_BADGE.C
        const faction = card?.faction ?? 'XX'
        const factionCls = FACTION_COLORS[faction] ?? 'text-gray-400 bg-gray-800 border-gray-700'

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
                <div className="text-gray-600 text-xs px-2 text-center">{card?.name ?? ref}</div>
              )}
            </div>

            {/* Card info */}
            <div className="p-1.5 space-y-1">
              <p className="text-xs font-medium leading-tight line-clamp-1 text-gray-200">
                {card?.name ?? ref}
              </p>
              <div className="flex items-center gap-1">
                <span className={`text-xs px-1 py-0.5 rounded border font-mono leading-none ${factionCls}`}>
                  {faction}
                </span>
                <span className={`text-xs px-1 py-0.5 rounded font-bold ml-auto leading-none ${rarity.cls}`}>
                  {rarity.label}
                </span>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
