import { FACTIONS } from '../lib/cardData.js'
import { FACTION_ICONS } from '../lib/assets.js'

// Free hero choice (config.freeHero): pick any hero from the full available roster when
// building a deck, instead of being limited to whatever heroes were drafted/opened.
// Heroes are sorted by faction then name. Clicking the selected hero again clears it.
export default function HeroPicker({ heroes, selected, onPick }) {
  if (!heroes?.length) return null
  const sorted = [...heroes].sort((a, b) => {
    const fa = FACTIONS.indexOf(a.faction), fb = FACTIONS.indexOf(b.faction)
    return fa !== fb ? fa - fb : (a.name ?? '').localeCompare(b.name ?? '')
  })
  return (
    <div className="px-4 py-3 border-b border-line bg-surface2/40 shrink-0">
      <p className="text-xs uppercase tracking-widest text-faint mb-2">
        Choose your hero <span className="text-faint/70">· {sorted.length} available · free choice</span>
      </p>
      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
        {sorted.map(h => {
          const active = h.reference === selected
          return (
            <button key={h.reference} onClick={() => onPick(active ? null : h.reference)} title={h.name}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border transition-colors ${
                active ? 'bg-accent text-on-accent border-accent font-semibold' : 'bg-surface2 hover:bg-surface3 text-ink border-line'}`}>
              {FACTION_ICONS[h.faction] && <img src={FACTION_ICONS[h.faction]} alt="" className="w-3.5 h-3.5 object-contain" />}
              {h.name ?? h.reference}
            </button>
          )
        })}
      </div>
    </div>
  )
}
