import { useState } from 'react'
import { FACTIONS, FACTION_NAMES, FACTION_COLORS } from '../lib/cardData.js'
import { FACTION_ICONS, RARITY_GEMS, SET_ICONS, setCodeFromRef } from '../lib/assets.js'
import { buildDecklist, groupPicksByFaction } from '../lib/exportFormat.js'
import ExportButton from './ExportButton.jsx'
import DraftStats from './DraftStats.jsx'

export default function DraftSidebar({ pickedRefs, cardMap, round, code }) {
  const [tab, setTab] = useState('picks')
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

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {['picks', 'stats'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-medium transition-colors capitalize ${
              tab === t
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'picks' ? (
          <div className="px-4 py-3 space-y-4">
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
                  <h4 className={`text-xs mb-1 inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded border ${FACTION_COLORS[f]}`}>
                    {FACTION_ICONS[f] && (
                      <img src={FACTION_ICONS[f]} alt="" className="w-3.5 h-3.5 object-contain" />
                    )}
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
        ) : (
          <DraftStats pickedRefs={pickedRefs} cardMap={cardMap} />
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
  const rarityGem = card?.rarity && card?.cardType !== 'HERO' ? RARITY_GEMS[card.rarity] : null
  const setIcon = SET_ICONS[setCodeFromRef(ref_)]
  return (
    <div className="flex items-center gap-1.5 text-xs py-0.5">
      <span className="w-5 text-center text-gray-500 font-mono shrink-0">{qty}</span>
      <span className="text-gray-300 truncate flex-1">{card?.name ?? ref_}</span>
      {rarityGem && <img src={rarityGem} alt={card.rarity} className="w-3.5 h-3.5 object-contain shrink-0" />}
      {setIcon && <img src={setIcon} alt="" className="w-3.5 h-3.5 object-contain shrink-0 opacity-60" />}
    </div>
  )
}
