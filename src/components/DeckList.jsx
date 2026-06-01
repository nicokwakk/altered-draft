import { RARITY_GEMS } from '../lib/assets.js'
import { cardSorter } from './PoolGrid.jsx'

/**
 * Deck shown as a single flat grid of card images — hero first,
 * then the default ordering (Character > Spell > Permanent, hand cost,
 * recall cost, name). Click − / + to adjust copies.
 */
export default function DeckList({ deck, cardMap, onRemove, onAdd, poolCounts }) {
  const cmp = cardSorter(cardMap)
  const entries = Object.entries(deck)
    .map(([ref, qty]) => ({ ref, qty, card: cardMap[ref] }))
    .sort((a, b) => cmp(a.ref, b.ref))

  return (
    <div className="px-4 pt-4 pb-40">
      <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
        {entries.map(({ ref, qty, card }) => (
          <Cell key={ref} ref_={ref} qty={qty} card={card}
            onRemove={onRemove} onAdd={onAdd} poolCounts={poolCounts} />
        ))}
      </div>
    </div>
  )
}

function Cell({ ref_, qty, card, onRemove, onAdd, poolCounts }) {
  const isHero = card?.cardType === 'HERO'
  return (
    <div className={`relative flex flex-col rounded-lg border bg-gray-900 ${isHero ? 'border-amber-500/60' : 'border-gray-700'}`}>
      <div className="aspect-[2/3] bg-gray-800 overflow-hidden rounded-t-lg relative cursor-zoom-in
        transition-transform duration-150 ease-out origin-top hover:scale-[1.6] hover:z-30 hover:shadow-xl hover:shadow-black/70">
        {card?.imagePath ? (
          <img src={card.imagePath} alt={card?.name} className="w-full h-full object-cover" loading="lazy"
            onError={e => { e.currentTarget.style.display = 'none' }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-1">
            <span className="text-xs text-gray-600 text-center leading-tight">{card?.name ?? ref_}</span>
          </div>
        )}
        {isHero && (
          <div className="absolute top-1 left-1 bg-amber-500 text-gray-950 font-bold text-xs px-1.5 py-0.5 rounded">Hero</div>
        )}
      </div>
      <div className="p-1">
        <p className="text-xs text-gray-300 leading-tight line-clamp-1">{card?.name ?? ''}</p>
        <div className="flex items-center gap-1 mt-1">
          <button onClick={() => onRemove(ref_)}
            className="w-5 h-5 rounded bg-gray-800 hover:bg-red-800 text-white font-bold flex items-center justify-center text-sm leading-none transition-colors">
            −
          </button>
          <span className="w-4 text-center text-xs font-bold text-amber-400">{qty}</span>
          {onAdd && (
            <button onClick={() => onAdd(ref_)} disabled={poolCounts && qty >= (poolCounts[ref_] ?? qty)}
              className="w-5 h-5 rounded bg-gray-800 hover:bg-green-800 disabled:opacity-25 text-white font-bold flex items-center justify-center text-sm leading-none transition-colors">
              +
            </button>
          )}
          <span className="ml-auto flex items-center gap-1">
            {!isHero && RARITY_GEMS[card?.rarity] && <img src={RARITY_GEMS[card.rarity]} alt="" className="w-3 h-3 object-contain" />}
          </span>
        </div>
      </div>
    </div>
  )
}
