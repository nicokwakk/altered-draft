import { SETS } from '../lib/cardData.js'
import { SET_ASSETS } from '../lib/assets.js'

/**
 * Multi-Set draft picker. Per-set booster counts; the required total depends on the
 * "same packs" toggle:
 *   ON  → counts are PER PLAYER and must sum to 4 (the four rounds). Every player
 *         drafts the same single-set boosters (one set per round).
 *   OFF → counts are the WHOLE BAG and must sum to players × 4. All single-set
 *         boosters are shuffled together and dealt at random (chaos).
 * `target` (passed in) is 4 when ON, players × 4 when OFF.
 */
export default function MultiSetSelector({ mix, onChange, equalPacks, onEqualChange, target = 4, disabled }) {
  const total = Object.values(mix).reduce((a, b) => a + (b || 0), 0)
  const reached = total === target

  function setCount(code, n) {
    const next = { ...mix }
    const v = Math.max(0, Math.min(target, n))
    if (v <= 0) delete next[code]
    else next[code] = v
    onChange(next)
  }

  return (
    <div className="space-y-4">
      {/* Distribution toggle */}
      <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
        equalPacks ? 'border-amber-500/40 bg-amber-500/5' : 'border-gray-700 bg-gray-800'}`}>
        <input type="checkbox" checked={equalPacks} disabled={disabled}
          onChange={e => onEqualChange(e.target.checked)} className="accent-amber-500 w-4 h-4 mt-0.5 shrink-0" />
        <span>
          <span className="block text-sm text-gray-200 font-medium">All players receive the same packs</span>
          <span className="block text-xs text-gray-500 mt-0.5">
            {equalPacks
              ? 'Every player drafts the same single-set boosters — one set per round.'
              : 'Build the whole booster bag — all boosters are shuffled and dealt at random.'}
          </span>
        </span>
      </label>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm text-gray-400">{equalPacks ? 'Packs per player' : 'Booster bag'}</label>
          <span className={`text-sm font-mono font-bold ${
            reached ? 'text-green-400' : total > target ? 'text-red-400' : 'text-amber-400'}`}>
            {total} / {target}
          </span>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          {equalPacks
            ? `Choose how many of each set make up one player's ${target} packs.`
            : `Choose how many single-set boosters of each set go in the bag (total = ${target}).`}
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
                    type="number" min={0} max={target} value={count}
                    onChange={e => setCount(set.code, parseInt(e.target.value) || 0)}
                    disabled={disabled}
                    className="w-12 bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-sm text-center focus:outline-none focus:border-amber-500"
                  />
                  <button type="button" onClick={() => !disabled && setCount(set.code, count + 1)} disabled={disabled || total >= target}
                    className="w-7 h-7 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white font-bold flex items-center justify-center leading-none">
                    +
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {!reached && (
          <p className={`text-xs mt-3 ${total > target ? 'text-red-400' : 'text-gray-500'}`}>
            {total > target
              ? `Remove ${total - target} ${total - target === 1 ? 'pack' : 'packs'} — the total must equal ${target}.`
              : `Add ${target - total} more ${target - total === 1 ? 'pack' : 'packs'} — the total must equal ${target}.`}
          </p>
        )}
      </div>
    </div>
  )
}
