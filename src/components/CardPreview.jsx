import { createPortal } from 'react-dom'
import { FACTION_NAMES, FACTION_COLORS } from '../lib/cardData.js'

export default function CardPreview({ card }) {
  if (!card) return null

  const faction = card.faction ?? 'XX'
  const factionCls = FACTION_COLORS[faction] ?? 'text-gray-400 bg-gray-800 border-gray-700'

  return createPortal(
    <div
      className="fixed bottom-6 right-6 z-50 w-64 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden pointer-events-none"
      style={{ boxShadow: '0 0 40px rgba(0,0,0,0.8)' }}
    >
      {card.imagePath ? (
        <img src={card.imagePath} alt={card.name} className="w-full object-cover" />
      ) : (
        <div className="aspect-[2/3] bg-gray-800 flex items-center justify-center text-gray-600 text-sm px-4 text-center">
          {card.name ?? card.reference}
        </div>
      )}

      <div className="p-3 space-y-2">
        <p className="font-semibold text-sm leading-tight">{card.name ?? card.reference}</p>

        <div className="flex items-center gap-2 flex-wrap">
          {faction !== 'XX' && (
            <span className={`text-xs px-2 py-0.5 rounded border ${factionCls}`}>
              {FACTION_NAMES[faction] ?? faction}
            </span>
          )}
          {card.rarity && (
            <span className="text-xs text-gray-500">{card.rarity}</span>
          )}
          {card.cardType && (
            <span className="text-xs text-gray-600">{card.cardType}</span>
          )}
        </div>

        {(card.mainCost != null || card.recallCost != null) && (
          <div className="flex gap-3 text-xs text-gray-400">
            {card.mainCost != null && <span>Cost: <strong className="text-gray-200">{card.mainCost}</strong></span>}
            {card.recallCost != null && <span>Recall: <strong className="text-gray-200">{card.recallCost}</strong></span>}
          </div>
        )}

        {(card.forestPower != null || card.mountainPower != null || card.oceanPower != null) && (
          <div className="flex gap-2 text-xs text-gray-400">
            {card.forestPower != null && <span>🌲{card.forestPower}</span>}
            {card.mountainPower != null && <span>⛰️{card.mountainPower}</span>}
            {card.oceanPower != null && <span>🌊{card.oceanPower}</span>}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
