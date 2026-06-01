import { SETS } from '../lib/cardData.js'
import { SET_ASSETS } from '../lib/assets.js'

/**
 * Chaos draft picker: choose how many boosters of each set go into the bag.
 * Counts need not be multiples of the player count — all boosters are shuffled
 * and dealt at random. Total must equal `target` (players × 4) to start.
 */
export default function ChaosSelector({ mix, onChange, target, disabled }) {
  const total = Object.values(mix).reduce((a, b) => a + (b || 0), 0)
  const reached = total === target

  function setCount(code, n) {
    const next = { ...mix }
    const v = Math.max(0, Math.min(99, n))
    if (v <= 0) delete next[code]
    else next[code] = v
    onChange(next)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm text-gray-400">Booster bag</label>
        <span className={`text-sm font-mono font-bold ${
          reached ? 'text-green-400' : total > target ? 'text-red-400' : 'text-amber-400'}`}>
          {total} / {target} boosters
        </span>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Pick any number of boosters per set — no need for a multiple of the player count.
        All {target} boosters are shuffled and dealt at random.
      </p>

      <div className="space-y-2">
        {SETS.filter(s => !s.hidden).map(set => {
          const count = mix[set.code] ?? 0
          const selected = count > 0
          const icon = SET_ASSETS[set.code]?.icon
          return (
            <div key={set.code} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
              selected ? 'border-amber-500/40 bg-amber-500/5' : 'border-gray-700 bg-gray-800'
            }`}>
              {icon
                ? <img src={icon} alt="" className="w-6 h-6 object-contain shrink-0" onError={e => { e.currentTarget.style.display = 'none' }} />
                : <span className="w-6 h-6 shrink-0" />}
              <span className="flex-1 text-sm text-gray-300">{set.name}</span>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => !disabled && setCount(set.code, count - 1)} disabled={disabled || count <= 0}
                  className="w-7 h-7 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white font-bold flex items-center justify-center leading-none">
                  −
                </button>
                <input
                  type="number" min={0} max={99} value={count}
                  onChange={e => setCount(set.code, parseInt(e.target.value) || 0)}
                  disabled={disabled}
                  className="w-12 bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-sm text-center focus:outline-none focus:border-amber-500"
                />
                <button type="button" onClick={() => !disabled && setCount(set.code, count + 1)} disabled={disabled}
                  className="w-7 h-7 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white font-bold flex items-center justify-center leading-none">
                  +
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {total !== target && (
        <p className={`text-xs mt-3 ${total > target ? 'text-red-400' : 'text-gray-500'}`}>
          {total > target
            ? `Remove ${total - target} booster${total - target !== 1 ? 's' : ''} — total must equal ${target}.`
            : `Add ${target - total} more booster${target - total !== 1 ? 's' : ''} to reach ${target}.`}
        </p>
      )}
    </div>
  )
}
