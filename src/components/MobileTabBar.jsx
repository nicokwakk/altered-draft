export default function MobileTabBar({ tab, setTab, pickCount }) {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-line flex z-40">
      {[
        { id: 'pack',  label: 'Pack',  icon: '🃏' },
        { id: 'picks', label: `Picks (${pickCount})`, icon: '📋' },
        { id: 'stats', label: 'Stats', icon: '📊' },
      ].map(t => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          className={`flex-1 py-3 flex flex-col items-center gap-0.5 text-xs transition-colors ${
            tab === t.id ? 'text-accent' : 'text-faint'
          }`}
        >
          <span className="text-base leading-none">{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  )
}
