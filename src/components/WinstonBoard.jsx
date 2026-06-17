// Winston board. **Honor-system rendering:** pile contents are revealed ONLY to the player
// whose turn it is, and ONLY for the pile they're currently looking at (peekIndex). Everyone
// else — and every other pile — is shown face-down as a count. The pile refs live in shared
// state, so this component is what keeps the hidden info hidden; never render a pile's cards
// to a player who shouldn't see them.

function nextNonEmpty(piles, from) {
  for (let k = from; k < piles.length; k++) if (piles[k].length) return k
  return -1
}

function MiniCard({ ref_, card, onHover }) {
  return (
    <div className="w-20 sm:w-24 rounded-lg overflow-hidden border border-line bg-surface2 shrink-0"
      title={card?.name ?? ref_}
      onMouseEnter={() => onHover?.(card ?? { reference: ref_, name: ref_ })}
      onMouseLeave={() => onHover?.(null)}>
      {card?.imagePath ? (
        <img src={card.imagePath} alt={card?.name ?? ''} loading="lazy"
          className="w-full aspect-[2/3] object-cover"
          onError={e => { e.currentTarget.style.display = 'none' }} />
      ) : (
        <div className="aspect-[2/3] flex items-center justify-center p-1 text-[10px] text-faint text-center leading-tight">
          {card?.name ?? ref_}
        </div>
      )}
    </div>
  )
}

// A face-down pile/deck: a card back with a count. `highlight` rings the pile the active
// player is currently looking at.
function FaceDown({ label, count, highlight }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={`w-20 sm:w-24 aspect-[2/3] rounded-lg border flex items-center justify-center relative
        bg-gradient-to-br from-surface3 to-surface2 ${highlight ? 'border-accent ring-2 ring-accent/50' : 'border-line'}`}>
        <span className="text-2xl text-faint/40 font-display select-none">A</span>
        <span className="absolute bottom-1 right-1 text-xs font-bold text-ink bg-surface/90 border border-line rounded px-1.5 py-0.5">
          {count}
        </span>
      </div>
      <span className={`text-xs ${highlight ? 'text-accent font-semibold' : 'text-faint'}`}>{label}</span>
    </div>
  )
}

export default function WinstonBoard({ state, myIndex, cardMap, isMyTurn, onAction, onHover, disabled }) {
  const piles = state.piles ?? [[], [], []]
  const deckCount = state.deck?.length ?? 0
  const rawPeek = state.peekIndex ?? 0
  // Match the engine's normalization: if the stored peek pile is empty (end-game), the player
  // is really looking at the next non-empty pile.
  const peek = piles[rawPeek]?.length ? rawPeek : (nextNonEmpty(piles, rawPeek) === -1 ? rawPeek : nextNonEmpty(piles, rawPeek))
  const opponent = state.players?.[myIndex === 0 ? 1 : 0]?.name ?? 'the other player'
  const currentPile = piles[peek] ?? []

  // Passing is only offered when it does something distinct from taking: while the deck has
  // cards, or when there's another non-empty pile to move to. In the end-game's last pile you
  // must Take.
  const isLastPile = nextNonEmpty(piles, peek + 1) === -1
  const canPass = deckCount > 0 || !isLastPile
  const passLabel = deckCount > 0
    ? (peek >= piles.length - 1 ? 'Pass (draw blind from deck)' : 'Pass (add a card, next pile)')
    : 'Pass to next pile'

  return (
    <div className="space-y-5">
      {/* Deck + piles row */}
      <div className="flex items-start gap-4 sm:gap-6 flex-wrap">
        <FaceDown label="Deck" count={deckCount} highlight={false} />
        <div className="w-px self-stretch bg-line hidden sm:block" />
        {piles.map((p, idx) => (
          <FaceDown key={idx} label={`Pile ${idx + 1}`} count={p.length}
            highlight={isMyTurn && idx === peek} />
        ))}
      </div>

      {isMyTurn ? (
        <div className="bg-surface border border-accent/30 rounded-xl p-4 space-y-3">
          <p className="text-sm text-ink2">
            You're looking at <span className="text-accent font-semibold">Pile {peek + 1}</span> ({currentPile.length} card{currentPile.length !== 1 ? 's' : ''}).
            Only you can see it.
          </p>
          {currentPile.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {currentPile.map((ref, i) => <MiniCard key={`${ref}-${i}`} ref_={ref} card={cardMap?.[ref]} onHover={onHover} />)}
            </div>
          ) : (
            <p className="text-sm text-faint">This pile is empty.</p>
          )}
          <div className="flex gap-3 pt-1">
            <button onClick={() => onAction('take')} disabled={disabled || currentPile.length === 0}
              className="px-4 py-2 bg-accent hover:bg-accent2 disabled:opacity-40 text-on-accent font-bold rounded-lg text-sm transition-colors">
              Take this pile
            </button>
            {canPass && (
              <button onClick={() => onAction('decline')} disabled={disabled}
                className="px-4 py-2 bg-surface2 hover:bg-surface3 disabled:opacity-40 text-ink2 font-medium rounded-lg text-sm transition-colors">
                {passLabel}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-lg px-4 py-3 text-sm text-muted">
          Waiting for <span className="text-ink">{opponent}</span> to take or pass… (piles stay hidden until your turn)
        </div>
      )}
    </div>
  )
}
