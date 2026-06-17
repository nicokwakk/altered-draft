import { useEffect, useRef } from 'react'
import { DRAFT_FORMATS } from '../lib/draftFormats.js'

const LANGS = ['EN', 'FR', 'ES', 'DE', 'IT']

// Pre-flight settings modal shown when the host clicks Start. Controlled: every value +
// setter lives in Lobby (so handleStart reads the same state); this just renders the final
// choices and launches. Draft shows Format + language + Heroes + pick timer; Sealed (no
// picking) shows only language + Heroes.
export default function StartSettingsModal({
  mode = 'draft',
  lang, setLang,
  heroMode, setHeroMode,
  timerEnabled, setTimerEnabled, timerSeconds, setTimerSeconds,
  draftFormat, setDraftFormat,
  playerCount,
  loading, startError,
  onStart, onClose,
}) {
  const panel = useRef(null)
  const isDraft = mode === 'draft'

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && !loading) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, loading])

  // 'Draft' heroes only applies to a draft (no pick phase in sealed).
  const heroOptions = [
    { v: 'packs', label: 'In packs', desc: 'Hero cards appear in boosters. Draft or open them.' },
    { v: 'free', label: 'Free choice', desc: 'Every available hero is added to your pool. Pick one at deckbuild; none appear in packs.' },
    ...(isDraft ? [{ v: 'draft', label: 'Draft', desc: 'Heroes are snake-drafted in-app: take turns picking from a shared hero pool. (Needs at least as many heroes as players, else they’re added to your pool instead.)' }] : []),
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 p-4 overflow-y-auto"
      onMouseDown={e => { if (panel.current && !panel.current.contains(e.target) && !loading) onClose() }}>
      <div ref={panel}
        className="bg-surface border border-line rounded-2xl shadow-2xl w-full max-w-lg my-8 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line sticky top-0 bg-surface z-10">
          <h2 className="font-display text-lg text-ink">{isDraft ? 'Draft settings' : 'Sealed settings'}</h2>
          <button onClick={onClose} disabled={loading}
            className="text-faint hover:text-ink2 disabled:opacity-40 transition-colors text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 space-y-6">

          {/* Draft Format — draft only */}
          {isDraft && (
            <div>
              <label className="block text-sm text-ink2 mb-2">Draft format</label>
              <div className="space-y-2">
                {DRAFT_FORMATS.map(f => {
                  const active = draftFormat === f.id
                  const disabled = !f.available
                  return (
                    <button key={f.id} type="button"
                      onClick={() => { if (!disabled) setDraftFormat(f.id) }}
                      disabled={disabled}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                        active ? 'border-accent bg-accent/5'
                        : disabled ? 'border-line bg-surface2/40 opacity-60 cursor-not-allowed'
                        : 'border-line bg-surface2 hover:bg-surface3'}`}>
                      <div className="flex items-center gap-2">
                        <span className={`mt-0.5 w-4 h-4 rounded-full border shrink-0 flex items-center justify-center ${
                          active ? 'border-accent' : 'border-faint'}`}>
                          {active && <span className="w-2 h-2 rounded-full bg-accent" />}
                        </span>
                        <span className={`text-sm font-medium ${active ? 'text-ink' : 'text-ink2'}`}>{f.name}</span>
                        <span className="text-[10px] uppercase tracking-wide text-faint border border-line rounded px-1 py-0.5">{f.players} players</span>
                        {disabled && <span className="ml-auto text-[10px] uppercase tracking-wide text-accent2">Coming soon</span>}
                      </div>
                      <p className="text-xs text-faint mt-1.5 leading-relaxed pl-6">{f.blurb}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Card language */}
          <div>
            <label className="block text-sm text-muted mb-2">Card language</label>
            <div className="flex gap-2 flex-wrap">
              {LANGS.map(l => (
                <button key={l} onClick={() => setLang(l)}
                  className={`px-3 py-1 rounded text-sm font-mono transition-colors ${lang === l
                    ? 'bg-accent text-on-accent font-bold'
                    : 'bg-surface2 hover:bg-surface3 text-ink2'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Heroes */}
          <div>
            <label className="block text-sm text-ink2 mb-2">Heroes</label>
            <div className="space-y-1.5">
              {heroOptions.map(o => {
                const active = heroMode === o.v
                return (
                  <button key={o.v} type="button" onClick={() => setHeroMode(o.v)}
                    className={`w-full flex items-start gap-2.5 text-left px-3 py-2 rounded-lg border transition-colors ${
                      active ? 'border-accent bg-accent/5' : 'border-line bg-surface2 hover:bg-surface3'}`}>
                    <span className={`mt-0.5 w-4 h-4 rounded-full border shrink-0 flex items-center justify-center ${
                      active ? 'border-accent' : 'border-faint'}`}>
                      {active && <span className="w-2 h-2 rounded-full bg-accent" />}
                    </span>
                    <span>
                      <span className={`text-sm ${active ? 'text-ink' : 'text-ink2'}`}>{o.label}</span>
                      <span className="block text-xs text-faint">{o.desc}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Pick timer — draft only (sealed has no pick passing) */}
          {isDraft && (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <input type="checkbox" id="timer-enabled" checked={timerEnabled}
                  onChange={e => setTimerEnabled(e.target.checked)}
                  className="accent-accent w-4 h-4" />
                <label htmlFor="timer-enabled" className="text-sm text-ink2 cursor-pointer">Pick timer</label>
              </div>
              {timerEnabled && (
                <div className="flex items-center gap-3 pl-7">
                  <span className="text-sm text-muted">Time per pick:</span>
                  <div className="flex gap-2">
                    {[30, 60, 90, 120].map(s => (
                      <button key={s} onClick={() => setTimerSeconds(s)}
                        className={`px-2.5 py-1 rounded text-sm transition-colors ${timerSeconds === s
                          ? 'bg-accent text-on-accent font-bold'
                          : 'bg-surface2 hover:bg-surface3 text-ink2'}`}>
                        {s}s
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {startError && <p className="text-red-400 text-sm">{startError}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-line sticky bottom-0 bg-surface">
          <button onClick={onClose} disabled={loading}
            className="px-4 py-2 rounded-lg bg-surface2 hover:bg-surface3 disabled:opacity-40 text-ink2 text-sm font-medium transition-colors">
            Cancel
          </button>
          <button onClick={onStart} disabled={loading}
            className="flex-1 py-2.5 bg-accent hover:bg-accent2 disabled:opacity-40 text-on-accent font-bold rounded-lg transition-colors">
            {loading ? 'Generating packs…' : isDraft ? 'Start draft' : 'Start sealed'}
          </button>
        </div>
      </div>
    </div>
  )
}
