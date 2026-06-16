import { createPortal } from 'react-dom'
import { FACTION_NAMES } from '../lib/cardData.js'
import { FACTION_ICONS, RARITY_GEMS } from '../lib/assets.js'

export default function CardPreview({ card }) {
  if (!card) return null

  const faction = card.faction ?? 'XX'
  const factionIcon = FACTION_ICONS[faction]
  const rarityGem = card.rarity ? RARITY_GEMS[card.rarity] : null

  return createPortal(
    <div
      className="fixed bottom-6 right-6 z-50 w-64 bg-surface border border-line rounded-xl shadow-2xl overflow-hidden pointer-events-none"
      style={{ boxShadow: '0 0 40px rgba(0,0,0,0.8)' }}
    >
      {card.imagePath ? (
        <img src={card.imagePath} alt={card.name} className="w-full object-cover"
          onError={e => { e.currentTarget.style.display = 'none' }} />
      ) : (
        <div className="aspect-[2/3] bg-surface2 flex items-center justify-center text-faint text-sm px-4 text-center">
          {card.name ?? card.reference}
        </div>
      )}

      <div className="p-3 space-y-2">
        <p className="font-semibold text-sm leading-tight">{card.name ?? card.reference}</p>

        <div className="flex items-center gap-2">
          {factionIcon && (
            <img src={factionIcon} alt={FACTION_NAMES[faction] ?? faction}
              className="w-5 h-5 object-contain"
              onError={e => { e.currentTarget.style.display = 'none' }} />
          )}
          <span className="text-xs text-muted">{FACTION_NAMES[faction] ?? faction}</span>
          {card.cardType && (
            <span className="text-xs text-faint ml-auto">{card.cardType.replace('_PERMANENT', '')}</span>
          )}
          {rarityGem && card.cardType !== 'HERO' && (
            <img src={rarityGem} alt={card.rarity} className="w-5 h-5 object-contain"
              onError={e => { e.currentTarget.style.display = 'none' }} />
          )}
        </div>

        {(card.mainCost != null || card.recallCost != null) && (
          <div className="flex gap-3 text-xs text-muted">
            {card.mainCost != null && <span>Cost: <strong className="text-ink">{card.mainCost}</strong></span>}
            {card.recallCost != null && <span>Recall: <strong className="text-ink">{card.recallCost}</strong></span>}
          </div>
        )}

        {(card.forestPower != null || card.mountainPower != null || card.oceanPower != null) && (
          <div className="flex gap-2 text-xs text-muted">
            {card.forestPower != null && <span>🌲 {card.forestPower}</span>}
            {card.mountainPower != null && <span>⛰️ {card.mountainPower}</span>}
            {card.oceanPower != null && <span>🌊 {card.oceanPower}</span>}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
