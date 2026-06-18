import { useZoomOrigin } from './PoolGrid.jsx'

// Standalone card art with the deckbuilder-style in-place hover zoom: the card grows under
// the cursor (instead of a detached preview panel), anchored to whichever viewport edge it's
// near so it never spills off-screen. `width` is a Tailwind width class; `overlay` renders
// badges on top of the art; `highlight` rings it (e.g. the blind-drawn Winston card).
export default function ZoomCard({ card, ref_, width = 'w-24', overlay = null, highlight = false, onClick, disabled = false }) {
  const { ref, origin, onMouseEnter } = useZoomOrigin()
  const name = card?.name ?? ref_
  const interactive = !!onClick && !disabled
  const cls = `${width} aspect-[2/3] shrink-0 relative overflow-hidden rounded-lg border bg-surface2
    transition-transform duration-150 ease-out hover:scale-[1.6] hover:z-30 hover:shadow-xl hover:shadow-black/70
    ${highlight ? 'border-accent ring-2 ring-accent/60' : 'border-line'}
    ${disabled ? 'opacity-60 cursor-not-allowed' : interactive ? 'cursor-pointer' : 'cursor-zoom-in'}`
  const inner = (
    <>
      {card?.imagePath ? (
        <img src={card.imagePath} alt={name} loading="lazy" className="w-full h-full object-cover"
          onError={e => { e.currentTarget.style.display = 'none' }} />
      ) : (
        <div className="w-full h-full flex items-center justify-center p-1 text-[10px] text-faint text-center leading-tight">{name}</div>
      )}
      {overlay}
    </>
  )
  return onClick ? (
    <button ref={ref} onMouseEnter={onMouseEnter} onClick={() => !disabled && onClick()} disabled={disabled}
      style={{ transformOrigin: origin }} title={name} className={`block ${cls}`}>{inner}</button>
  ) : (
    <div ref={ref} onMouseEnter={onMouseEnter} style={{ transformOrigin: origin }} title={name} className={cls}>{inner}</div>
  )
}
