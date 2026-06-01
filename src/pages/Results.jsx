import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { fetchSet, apiSetCode } from '../lib/cardData.js'
import { buildDecklist } from '../lib/exportFormat.js'
import { FACTIONS, FACTION_NAMES, FACTION_COLORS } from '../lib/cardData.js'
import { FACTION_ICONS, SET_ICONS, RARITY_GEMS, setCodeFromRef } from '../lib/assets.js'
import ExportButton from '../components/ExportButton.jsx'
import DraftStats from '../components/DraftStats.jsx'

export default function Results() {
  const { code } = useParams()
  const navigate = useNavigate()

  const [roomState, setRoomState] = useState(null)
  const [me, setMe] = useState(null)
  const [cardMap, setCardMap] = useState({})
  const [tab, setTab] = useState('picks') // 'picks' | 'deck' | 'stats' | 'players'
  const [deck, setDeck] = useState({})   // { [ref]: qty }

  useEffect(() => {
    const stored = localStorage.getItem(`player_${code}`)
    if (!stored) { navigate('/'); return }
    setMe(JSON.parse(stored))
  }, [code, navigate])

  useEffect(() => {
    supabase.from('draft_rooms').select('state').eq('id', code).single()
      .then(async ({ data }) => {
        if (!data) { navigate('/'); return }
        setRoomState(data.state)
        if (data.state.config.sets?.length) {
          const apiCodes = [...new Set(data.state.config.sets.map(apiSetCode))]
          const maps = {}
          await Promise.all(apiCodes.map(async s => {
            const cards = await fetchSet(s, data.state.config.lang || 'EN').catch(() => [])
            for (const c of cards) maps[c.reference] = c
          }))
          setCardMap(maps)
        }
      })
  }, [code, navigate])

  useEffect(() => {
    if (!me) return
    const stored = localStorage.getItem(`draft_deck_${code}_${me.id}`)
    if (stored) setDeck(JSON.parse(stored))
  }, [me, code])

  function saveDeck(next) {
    setDeck(next)
    if (me) localStorage.setItem(`draft_deck_${code}_${me.id}`, JSON.stringify(next))
  }

  if (!roomState || !me) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading results…</div>
  }

  const myIndex = roomState.players.findIndex(p => p.id === me.id)
  const myPicks = roomState.picks[String(myIndex)] ?? []

  // Pool counts (how many of each card was drafted)
  const poolCounts = {}
  for (const ref of myPicks) poolCounts[ref] = (poolCounts[ref] ?? 0) + 1

  // Deck helpers
  const deckTotal = Object.values(deck).reduce((a, b) => a + b, 0)
  const deckRefs = Object.entries(deck).flatMap(([ref, qty]) => Array(qty).fill(ref))
  const deckNonHero = deckRefs.filter(r => cardMap[r]?.cardType !== 'HERO')
  const deckFactions = new Set(deckNonHero.map(r => cardMap[r]?.faction).filter(Boolean))
  const deckHeroCount = deckRefs.filter(r => cardMap[r]?.cardType === 'HERO').length
  const isEnough = deckNonHero.length >= 30
  const isValidFactions = deckFactions.size <= 3
  const isValid = isEnough && isValidFactions

  const allDecklist = buildDecklist(myPicks, cardMap)
  const deckDecklist = buildDecklist(deckRefs, cardMap)

  function addToDeck(ref) {
    const have = poolCounts[ref] ?? 0
    const inDeck = deck[ref] ?? 0
    if (inDeck >= have) return
    saveDeck({ ...deck, [ref]: inDeck + 1 })
  }

  function removeFromDeck(ref) {
    const inDeck = deck[ref] ?? 0
    if (inDeck <= 0) return
    const next = { ...deck }
    if (inDeck === 1) delete next[ref]
    else next[ref] = inDeck - 1
    saveDeck(next)
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center gap-3 shrink-0">
        <span className="font-mono text-amber-400 font-bold">{code}</span>
        <span className="text-gray-400 text-sm">Draft Complete · {myPicks.length} picks</span>
        <div className="ml-auto flex gap-2">
          {tab === 'deck'
            ? <ExportButton decklist={deckDecklist} />
            : <ExportButton decklist={allDecklist} />}
          <a href="https://altered.re/pages/decks" target="_blank" rel="noopener noreferrer"
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-sm rounded-lg text-gray-300 transition-colors">
            altered.re ↗
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-900 border-b border-gray-800 flex shrink-0">
        {[
          { id: 'picks',   label: `All Picks (${new Set(myPicks).size})` },
          { id: 'deck',    label: `Deck (${deckTotal})`, highlight: isValid },
          { id: 'stats',   label: 'Stats' },
          { id: 'players', label: 'Players' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 text-sm transition-colors ${
              tab === t.id
                ? t.highlight ? 'text-green-400 border-b-2 border-green-400' : 'text-amber-400 border-b-2 border-amber-400'
                : 'text-gray-500 hover:text-gray-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ALL PICKS TAB */}
      {tab === 'picks' && (
        <div className="flex-1 overflow-y-auto p-4">
          <PicksGrid picks={myPicks} poolCounts={poolCounts} cardMap={cardMap}
            deck={deck} onAdd={addToDeck} onRemove={removeFromDeck} />
        </div>
      )}

      {/* DECK TAB */}
      {tab === 'deck' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className={`px-4 py-2 border-b shrink-0 flex flex-wrap gap-3 items-center text-sm ${
            isValid ? 'border-green-800 bg-green-900/20' : 'border-gray-800 bg-gray-900'}`}>
            <span className={isEnough ? 'text-green-400' : 'text-red-400'}>
              {isEnough ? '✓' : '✗'} {deckNonHero.length}/30 cards
            </span>
            <span className={isValidFactions ? 'text-green-400' : 'text-red-400'}>
              {isValidFactions ? '✓' : '✗'} {deckFactions.size}/3 factions
            </span>
            {deckHeroCount > 0 && (
              <span className="text-amber-400">⚔ {deckHeroCount} hero{deckHeroCount > 1 ? 'es' : ''}</span>
            )}
            {isValid && <span className="text-green-400 font-semibold ml-auto">Deck is valid ✓</span>}
          </div>
          {deckTotal === 0
            ? <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                No cards in deck yet — add them from the Picks tab.
              </div>
            : <div className="flex-1 overflow-y-auto p-4">
                <DeckList deck={deck} cardMap={cardMap} onRemove={removeFromDeck} />
              </div>}
        </div>
      )}

      {/* STATS TAB */}
      {tab === 'stats' && (
        <div className="flex-1 overflow-y-auto">
          <DraftStats pickedRefs={myPicks} cardMap={cardMap} />
        </div>
      )}

      {/* PLAYERS TAB */}
      {tab === 'players' && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {roomState.players.map((player, i) => {
              const picks = roomState.picks[String(i)] ?? []
              const factionCounts = {}
              for (const ref of picks) {
                const card = cardMap[ref]
                if (!card || card.cardType === 'HERO') continue
                factionCounts[card.faction] = (factionCounts[card.faction] ?? 0) + 1
              }
              return (
                <div key={player.id} className="bg-gray-900 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="font-medium">{player.name}</span>
                    {player.id === me.id && <span className="text-xs text-amber-400">(you)</span>}
                    <span className="ml-auto text-xs text-gray-500">{picks.length} picks</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {FACTIONS.filter(f => factionCounts[f]).map(f => (
                      <span key={f} className={`text-xs px-2 py-0.5 rounded border inline-flex items-center gap-1 ${FACTION_COLORS[f]}`}>
                        {FACTION_ICONS[f] && <img src={FACTION_ICONS[f]} alt="" className="w-3 h-3 object-contain" />}
                        {FACTION_NAMES[f]} {factionCounts[f]}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Picks grid with +/- deck controls ──────────────────────────────────────
function PicksGrid({ picks, poolCounts, cardMap, deck, onAdd, onRemove }) {
  const uniqueRefs = [...new Set(picks)]
  const byFaction = { HERO: [], ...Object.fromEntries(FACTIONS.map(f => [f, []])) }
  for (const ref of uniqueRefs) {
    const card = cardMap[ref]
    const key = card?.cardType === 'HERO' ? 'HERO' : (card?.faction ?? 'HERO')
    ;(byFaction[key] = byFaction[key] ?? []).push(ref)
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {['HERO', ...FACTIONS].filter(k => byFaction[k]?.length).map(key => {
        const isHero = key === 'HERO'
        const factionCls = isHero
          ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
          : FACTION_COLORS[key] ?? 'text-gray-400 bg-gray-800 border-gray-700'
        const total = byFaction[key].reduce((sum, ref) => sum + (poolCounts[ref] ?? 1), 0)
        return (
          <div key={key}>
            <div className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded border mb-2 ${factionCls}`}>
              {FACTION_ICONS[key] && <img src={FACTION_ICONS[key]} alt="" className="w-3.5 h-3.5 object-contain" />}
              {isHero ? 'Hero' : FACTION_NAMES[key] ?? key}
              <span className="opacity-60">({total})</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 gap-2">
              {byFaction[key].map(ref => {
                const card = cardMap[ref]
                const poolQty = poolCounts[ref] ?? 1
                const inDeck = deck[ref] ?? 0
                const canAdd = inDeck < poolQty
                const canRemove = inDeck > 0
                const setIcon = SET_ICONS[setCodeFromRef(ref)]
                return (
                  <div key={ref} className="relative flex flex-col rounded-lg overflow-hidden border border-gray-700 bg-gray-900 group">
                    <div className="aspect-[2/3] bg-gray-800 overflow-hidden">
                      {card?.imagePath ? (
                        <img src={card.imagePath} alt={card?.name} className="w-full h-full object-cover" loading="lazy"
                          onError={e => { e.currentTarget.style.display = 'none' }} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center p-1">
                          <span className="text-xs text-gray-600 text-center">{card?.name ?? ref}</span>
                        </div>
                      )}
                      {poolQty > 1 && (
                        <div className="absolute top-1 left-1 bg-gray-900/90 text-gray-400 text-xs px-1 py-0.5 rounded border border-gray-600 font-bold">
                          ×{poolQty}
                        </div>
                      )}
                      {/* +/- controls */}
                      <div className={`absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1 px-1 py-1.5 bg-black/70
                        transition-opacity ${inDeck > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <button onClick={() => onRemove(ref)} disabled={!canRemove}
                          className="w-6 h-6 rounded bg-gray-700 hover:bg-red-800 disabled:opacity-30 text-white font-bold flex items-center justify-center text-sm transition-colors">
                          −
                        </button>
                        <span className={`w-5 text-center text-xs font-bold ${inDeck > 0 ? 'text-amber-400' : 'text-gray-500'}`}>{inDeck}</span>
                        <button onClick={() => onAdd(ref)} disabled={!canAdd}
                          className="w-6 h-6 rounded bg-gray-700 hover:bg-green-800 disabled:opacity-30 text-white font-bold flex items-center justify-center text-sm transition-colors">
                          +
                        </button>
                      </div>
                    </div>
                    <div className="p-1">
                      <p className="text-xs text-gray-300 leading-tight line-clamp-1">{card?.name ?? ''}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {FACTION_ICONS[card?.faction] && <img src={FACTION_ICONS[card.faction]} alt="" className="w-3 h-3 object-contain" />}
                        {card?.cardType !== 'HERO' && RARITY_GEMS[card?.rarity] && <img src={RARITY_GEMS[card.rarity]} alt="" className="w-3 h-3 object-contain" />}
                        {setIcon && <img src={setIcon} alt="" className="w-3 h-3 object-contain ml-auto opacity-50" onError={e => { e.currentTarget.style.display = 'none' }} />}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Deck list (same as sealed) ──────────────────────────────────────────────
function DeckList({ deck, cardMap, onRemove }) {
  const groups = {}
  for (const [ref, qty] of Object.entries(deck)) {
    const card = cardMap[ref]
    const key = card?.cardType === 'HERO' ? 'HERO' : (card?.faction ?? '??')
    if (!groups[key]) groups[key] = []
    groups[key].push({ ref, qty, card })
  }
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {['HERO', ...FACTIONS].filter(k => groups[k]).map(key => {
        const isHero = key === 'HERO'
        const factionCls = isHero ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' : FACTION_COLORS[key] ?? 'text-gray-300 bg-gray-800 border-gray-700'
        const total = groups[key].reduce((a, { qty }) => a + qty, 0)
        return (
          <div key={key}>
            <div className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded border mb-2 ${factionCls}`}>
              {FACTION_ICONS[key] && <img src={FACTION_ICONS[key]} alt="" className="w-3.5 h-3.5 object-contain" />}
              {isHero ? 'Hero' : FACTION_NAMES[key] ?? key} <span className="opacity-60">({total})</span>
            </div>
            <div className="space-y-1">
              {groups[key].sort((a, b) => (a.card?.name ?? '').localeCompare(b.card?.name ?? '')).map(({ ref, qty, card }) => (
                <div key={ref} className="flex items-center gap-2 py-0.5">
                  <span className="w-6 text-center text-amber-400 font-bold text-sm shrink-0">{qty}</span>
                  <span className="text-gray-300 text-sm flex-1 truncate">{card?.name ?? ref}</span>
                  {card?.cardType !== 'HERO' && RARITY_GEMS[card?.rarity] && <img src={RARITY_GEMS[card.rarity]} alt="" className="w-3.5 h-3.5 object-contain shrink-0" />}
                  <button onClick={() => onRemove(ref)}
                    className="w-6 h-6 rounded bg-gray-800 hover:bg-red-900/50 text-gray-400 hover:text-red-400 flex items-center justify-center text-sm shrink-0 transition-colors">
                    −
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
