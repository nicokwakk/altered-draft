import { SETS } from '../lib/cardData.js'

export default function SetSelector({ selectedSets, onChange, disabled }) {
  function toggleSet(code) {
    const next = { ...selectedSets }
    if (next[code]) {
      delete next[code]
    } else {
      next[code] = 1
    }
    onChange(next)
  }

  function updateCount(code, val) {
    const n = Math.max(1, parseInt(val) || 1)
    onChange({ ...selectedSets, [code]: n })
  }

  return (
    <div>
      <label className="block text-sm text-gray-400 mb-2">Sets to draft from</label>
      <div className="space-y-2">
        {SETS.map(set => {
          const selected = !!selectedSets[set.code]
          return (
            <div key={set.code} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
              selected ? 'border-amber-500/40 bg-amber-500/5' : 'border-gray-700 bg-gray-800'
            }`}>
              <input
                type="checkbox"
                id={`set-${set.code}`}
                checked={selected}
                onChange={() => !disabled && toggleSet(set.code)}
                disabled={disabled}
                className="accent-amber-500"
              />
              <label htmlFor={`set-${set.code}`} className="flex-1 cursor-pointer">
                <span className="text-sm text-gray-300">{set.name}</span>
              </label>
              {selected && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500">packs:</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={selectedSets[set.code]}
                    onChange={e => updateCount(set.code, e.target.value)}
                    disabled={disabled}
                    className="w-12 bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-sm text-center focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
