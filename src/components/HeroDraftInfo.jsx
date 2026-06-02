import { useState } from 'react'

/**
 * Read-only panel for cubes whose heroes are snake-drafted MANUALLY (outside the
 * app). Shows the hero pool + the rules so the group can run the picks themselves.
 */
export default function HeroDraftInfo({ heroes, cardMap }) {
  const [open, setOpen] = useState(false)
  if (!heroes?.length) return null

  return (
    <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg mb-3">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left">
        <span className="text-sm font-semibold text-amber-400">Hero draft (manual)</span>
        <span className="text-xs text-gray-500">· {heroes.length} heroes</span>
        <span className="ml-auto text-xs text-gray-500">{open ? '▼ hide' : '▶ rules'}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3">
          <ol className="text-xs text-gray-400 list-decimal list-inside space-y-1">
            <li>Pick a starting player.</li>
            <li>At the end of pack 2, each player takes 1 hero — starting player first, then clockwise.</li>
            <li>At the end of the draft, each player takes 1 more — the last player to pick goes first, then counter-clockwise.</li>
          </ol>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {heroes.map(ref => {
              const card = cardMap?.[ref]
              return (
                <div key={ref} className="rounded-lg overflow-hidden border border-gray-700 bg-gray-800"
                  title={card?.name ?? ref}>
                  {card?.imagePath ? (
                    <img src={card.imagePath} alt={card?.name ?? ''} loading="lazy"
                      className="w-full aspect-[2/3] object-cover"
                      onError={e => { e.currentTarget.style.display = 'none' }} />
                  ) : (
                    <div className="aspect-[2/3] flex items-center justify-center p-1 text-[10px] text-gray-500 text-center leading-tight">
                      {card?.name ?? ref}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
