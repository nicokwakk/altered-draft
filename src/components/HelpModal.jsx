import { createPortal } from 'react-dom'

// Short "how it works" overlay opened from the top menu.
export default function HelpModal({ onClose }) {
  const Section = ({ title, children }) => (
    <div>
      <h3 className="font-display text-base font-semibold text-ink mb-1">{title}</h3>
      <p className="text-sm text-ink2 leading-relaxed">{children}</p>
    </div>
  )
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-surface rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl border border-line">
        <div className="flex items-center justify-between p-5 border-b border-line shrink-0">
          <h2 className="font-display text-lg text-ink">How it works</h2>
          <button onClick={onClose} className="text-faint hover:text-ink text-xl leading-none p-1">✕</button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          <Section title="Draft">
            Create a room, share the code or link, and gather 2+ players. Over 4 rounds you pick one card
            from each passing booster, then build a deck from everything you drafted.
          </Section>
          <Section title="Sealed">
            Open a set of boosters, solo or with friends, and build the best deck you can from your pool.
            No passing; it's all yours.
          </Section>
          <Section title="Cubes">
            Curated card pools you can draft or seal. Use a built-in community cube, paste your own list,
            or load one (or several, merged) from your Re:Union decks.
          </Section>
          <Section title="Re:Union (optional)">
            Connect your official Re:Union account to load your decks as cubes and save your drafted pool +
            final deck straight back to your account. Everything works anonymously without it.
          </Section>
          <Section title="Exporting">
            When you're done, use Export / Save to copy your decklist for altered.re or push it to Re:Union.
          </Section>
        </div>
      </div>
    </div>,
    document.body
  )
}
