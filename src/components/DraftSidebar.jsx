import { FACTIONS, FACTION_NAMES, FACTION_COLORS } from '../lib/cardData.js'
import { buildDecklist, groupPicksByFaction } from '../lib/exportFormat.js'
import ExportButton from './ExportButton.jsx'

export default function DraftSidebar({ pickedRefs, cardMap, round, code }) {
  const grouped = groupPicksByFaction(pickedRefs, cardMap)
  const decklist = buildDecklist(pickedRefs, cardMap)
  const total = pickedRefs.length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Your picks</h3>
          <span className="text-xs text-gray-500">{total} cards</span>
        </div>
        <div className="mt-1 flex gap-1">
          {[1, 2, 3, 4].map(r => (
            <div key={r} className={`h-1 flex-1 rounded-full ${r <= round ? 'bg-amber-500' : 'bg-gray-700'}`} />
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-1">Pack {round} of 4</p>
      </div>

      {/* Picks list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Heroes */}
        {grouped.HERO && (
          <section>
            <h4 className="text-xs uppercase tracking-widest text-amber-400 mb-1">Hero</h4>
            {Object.entries(grouped.HERO).map(([ref, qty]) => (
              <PickRow key={ref} ref_={ref} qty={qty} card={cardMap[ref]} />
            ))}
          </section>
        )}

        {FACTIONS.map(f => {
          const group = grouped[f]
          if (!group) return null
          const fTotal = Object.values(group).reduce((a, b) => a + b, 0)
          return (
            <section key={f}>
              <h4 className={`text-xs uppercase tracking-widest mb-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${FACTION_COLORS[f]}`}>
                {FACTION_NAMES[f] ?? f} <span className="opacity-60">({fTotal})</span>
              </h4>
              <div className="space-y-0.5">
                {Object.entries(group)
                  .sort((a, b) => (cardMap[a[0]]?.name ?? '').localeCompare(cardMap[b[0]]?.name ?? ''))
                  .map(([ref, qty]) => (
                    <PickRow key={ref} ref_={ref} qty={qty} card={cardMap[ref]} />
                  ))}
              </div>
            </section>
          )
        })}

        {total === 0 && (
          <p className="text-xs text-gray-600 italic">No picks yet — click a card to draft it.</p>
        )}
      </div>

      {/* Export */}
      <div className="p-4 border-t border-gray-800">
        <ExportButton decklist={decklist} small />
      </div>
    </div>
  )
}

function PickRow({ ref_, qty, card }) {
  return (
    <div className="flex items-center gap-2 text-xs py-0.5">
      <span className="w-5 text-center text-gray-500 font-mono">{qty}</span>
      <span className="text-gray-300 truncate flex-1">{card?.name ?? ref_}</span>
      <span className="text-gray-600 font-mono text-xs shrink-0">{card?.rarity ?? ''}</span>
    </div>
  )
}
