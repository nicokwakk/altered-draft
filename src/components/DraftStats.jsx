import { FACTIONS, FACTION_NAMES, FACTION_COLORS } from '../lib/cardData.js'

const TYPE_GROUPS = {
  HERO:                 { label: 'Hero',       color: 'text-amber-400' },
  CHARACTER:            { label: 'Character',  color: 'text-blue-400' },
  SPELL:                { label: 'Spell',      color: 'text-purple-400' },
  LANDMARK_PERMANENT:   { label: 'Permanent',  color: 'text-green-400' },
  EXPEDITION_PERMANENT: { label: 'Permanent',  color: 'text-green-400' },
}

export default function DraftStats({ pickedRefs, cardMap }) {
  if (!pickedRefs.length) {
    return <p className="text-xs text-gray-600 italic px-4 py-3">No picks yet.</p>
  }

  const cards = pickedRefs.map(r => cardMap[r]).filter(Boolean)
  const total = cards.length

  // Faction breakdown
  const factionCounts = {}
  for (const c of cards) {
    if (c.cardType === 'HERO') continue
    factionCounts[c.faction] = (factionCounts[c.faction] ?? 0) + 1
  }

  // Card type breakdown (merge permanents)
  const typeCounts = {}
  for (const c of cards) {
    const group = TYPE_GROUPS[c.cardType]?.label ?? c.cardType
    typeCounts[group] = (typeCounts[group] ?? 0) + 1
  }

  // Cost curve (main cost, exclude heroes and cards without cost)
  const costCounts = {}
  let maxCost = 0
  for (const c of cards) {
    if (c.cardType === 'HERO' || c.mainCost == null) continue
    const cost = Number(c.mainCost)
    if (isNaN(cost)) continue
    costCounts[cost] = (costCounts[cost] ?? 0) + 1
    if (cost > maxCost) maxCost = cost
  }
  const costMax = Math.max(...Object.values(costCounts), 1)

  return (
    <div className="px-4 py-3 space-y-5 overflow-y-auto">

      {/* Faction split */}
      <section>
        <h4 className="text-xs uppercase tracking-widest text-gray-500 mb-2">Faction split</h4>
        <div className="space-y-1.5">
          {FACTIONS.filter(f => factionCounts[f]).map(f => {
            const count = factionCounts[f] ?? 0
            const pct = Math.round((count / (total - (typeCounts['Hero'] ?? 0))) * 100)
            return (
              <div key={f} className="flex items-center gap-2">
                <span className={`text-xs w-16 shrink-0 px-1.5 py-0.5 rounded border font-mono ${FACTION_COLORS[f]}`}>
                  {FACTION_NAMES[f]}
                </span>
                <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${pct}%`, backgroundColor: factionBarColor(f) }}
                  />
                </div>
                <span className="text-xs text-gray-400 w-8 text-right">{count}</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Card type breakdown */}
      <section>
        <h4 className="text-xs uppercase tracking-widest text-gray-500 mb-2">Card types</h4>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(typeCounts).map(([type, count]) => {
            const group = Object.values(TYPE_GROUPS).find(g => g.label === type)
            return (
              <div key={type} className="bg-gray-800 rounded-lg px-3 py-2 flex items-center justify-between">
                <span className={`text-xs font-medium ${group?.color ?? 'text-gray-400'}`}>{type}</span>
                <span className="text-sm font-bold text-gray-200">{count}</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Cost curve */}
      {Object.keys(costCounts).length > 0 && (
        <section>
          <h4 className="text-xs uppercase tracking-widest text-gray-500 mb-2">Cost curve</h4>
          <div className="flex items-end gap-1 h-16">
            {Array.from({ length: maxCost + 1 }, (_, i) => i).map(cost => {
              const count = costCounts[cost] ?? 0
              const height = count ? Math.max(8, Math.round((count / costMax) * 56)) : 4
              return (
                <div key={cost} className="flex flex-col items-center gap-1 flex-1">
                  <div
                    className="w-full rounded-t transition-all duration-300"
                    style={{
                      height: `${height}px`,
                      backgroundColor: count ? '#f59e0b' : '#1f2937',
                    }}
                    title={`Cost ${cost}: ${count} card${count !== 1 ? 's' : ''}`}
                  />
                  <span className="text-xs text-gray-600">{cost}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

    </div>
  )
}

const FACTION_BAR_COLORS = {
  AX: '#894b33',
  BR: '#9e3c40',
  LY: '#d89da3',
  MU: '#3f9085',
  OR: '#00628e',
  YZ: '#6d4f95',
}

function factionBarColor(f) {
  return FACTION_BAR_COLORS[f] ?? '#6b7280'
}
