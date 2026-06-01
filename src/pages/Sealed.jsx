import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { fetchSet, apiSetCode, FACTIONS, FACTION_NAMES, FACTION_COLORS, SET_ABBREV, SET_ABBREV_ICON_CODE } from '../lib/cardData.js'
import { FACTION_ICONS, RARITY_GEMS, SET_ICONS } from '../lib/assets.js'
import { buildDecklist } from '../lib/exportFormat.js'
import ExportButton from '../components/ExportButton.jsx'
import DraftStats from '../components/DraftStats.jsx'

export default function Sealed() {
  const { code } = useParams()
  const navigate = useNavigate()

  const [roomState, setRoomState] = useState(null)
  const [me, setMe] = useState(null)
  const [cardMap, setCardMap] = useState({})
  const [packIndex, setPackIndex] = useState(0)
  const [tab, setTab] = useState('booster') // 'booster' | 'pool' | 'deck' | 'stats'
  const [deck, setDeck] = useState({})      // { [ref]: qty }
  const [loading, setLoading] = useState(true)
  const [filterFaction, setFilterFaction] = useState('ALL')
  const [sortBy, setSortBy] = useState('faction')

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
        const sets = data.state.config.sets ?? []
        const apiCodes = [...new Set(sets.map(apiSetCode))]
        const maps = {}
        await Promise.all(apiCodes.map(async s => {
          const cards = await fetchSet(s, data.state.config.lang || 'EN').catch(() => [])
          for (const c of cards) maps[c.reference] = c
        }))
        setCardMap(maps)
        setLoading(false)
      })
  }, [code, navigate])

  // Load deck from localStorage
  useEffect(() => {
    if (!me) return
    const stored = localStorage.getItem(`sealed_deck_${code}_${me.id}`)
    if (stored) setDeck(JSON.parse(stored))
  }, [me, code])

  function saveDeck(next) {
    setDeck(next)
    if (me) localStorage.setItem(`sealed_deck_${code}_${me.id}`, JSON.stringify(next))
  }

  if (!roomState || !me) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>

  const myIndex = roomState.players.findIndex(p => p.id === me.id)
  const myPacks = roomState.sealedPacks?.[String(myIndex)]
    ?? (roomState.sealedPools?.[String(myIndex)] ? [roomState.sealedPools[String(myIndex)]] : [])
  const totalPacks = myPacks.length
  const allRefs = myPacks.flat()

  // Count how many of each card is in the pool
  const poolCounts = {}
  for (const ref of allRefs) poolCounts[ref] = (poolCounts[ref] ?? 0) + 1

  const currentPack = myPacks[packIndex] ?? []
  const allDecklist = buildDecklist(allRefs, cardMap)

  // Deck helpers
  const deckTotal = Object.values(deck).reduce((a, b) => a + b, 0)
  const deckRefs = Object.entries(deck).flatMap(([ref, qty]) => Array(qty).fill(ref))
  const deckDecklist = buildDecklist(deckRefs, cardMap)

  // Deck validity
  const deckNonHero = deckRefs.filter(r => cardMap[r]?.cardType !== 'HERO')
  const deckFactions = new Set(deckNonHero.map(r => cardMap[r]?.faction).filter(Boolean))
  const deckHeroCount = deckRefs.filter(r => cardMap[r]?.cardType === 'HERO').length
  const isEnough = deckNonHero.length >= 30
  const isValidFactions = deckFactions.size <= 3
  const isValid = isEnough && isValidFactions

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

  const poolRefs = filterFaction === 'ALL'
    ? allRefs
    : allRefs.filter(r => cardMap[r]?.faction === filterFaction)

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center gap-3 shrink-0">
        <span className="font-mono text-amber-400 font-bold text-sm">{code}</span>
        <span className="text-gray-400 text-sm">Sealed</span>
        <div className="ml-auto flex gap-2">
          {tab === 'deck'
            ? <ExportButton decklist={deckDecklist} />
            : <ExportButton decklist={allDecklist} />}
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-gray-900 border-b border-gray-800 flex shrink-0">
        {[
          { id: 'booster', label: `Boosters (${totalPacks})` },
          { id: 'pool',    label: `Full Pool (${new Set(allRefs).size})` },
          { id: 'deck',    label: `Deck (${deckTotal})`, highlight: isValid },
          { id: 'stats',   label: 'Stats' },
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

      {/* BOOSTER TAB */}
      {tab === 'booster' && (
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 shrink-0">
            <button onClick={() => setPackIndex(i => Math.max(0, i - 1))} disabled={packIndex === 0}
              className="w-8 h-8 rounded-lg bg-gray-800 disabled:opacity-30 flex items-center justify-center text-gray-300 hover:bg-gray-700">
              ‹
            </button>
            <div className="flex gap-1 flex-1 justify-center">
              {myPacks.map((_, i) => (
                <button key={i} onClick={() => setPackIndex(i)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${
                    i === packIndex ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                  {i + 1}
                </button>
              ))}
            </div>
            <button onClick={() => setPackIndex(i => Math.min(totalPacks - 1, i + 1))} disabled={packIndex === totalPacks - 1}
              className="w-8 h-8 rounded-lg bg-gray-800 disabled:opacity-30 flex items-center justify-center text-gray-300 hover:bg-gray-700">
              ›
            </button>
          </div>
          <div className="p-4">
            <h2 className="font-semibold mb-3">Booster {packIndex + 1} <span className="text-gray-500 text-sm font-normal">· {currentPack.length} cards</span></h2>
            <CardPool refs={currentPack} cardMap={cardMap} loading={loading}
              deck={deck} poolCounts={poolCounts} onAdd={addToDeck} onRemove={removeFromDeck} />
          </div>
        </div>
      )}

      {/* FULL POOL TAB */}
      {tab === 'pool' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-800 flex gap-1.5 flex-wrap shrink-0 bg-gray-950">
            <button onClick={() => setFilterFaction('ALL')}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${filterFaction === 'ALL' ? 'bg-gray-600 text-gray-100' : 'text-gray-500 hover:text-gray-300'}`}>
              All
            </button>
            {FACTIONS.map(f => (
              <button key={f} onClick={() => setFilterFaction(f === filterFaction ? 'ALL' : f)}
                className={`px-2 py-1 rounded text-xs transition-colors flex items-center gap-1 border ${
                  filterFaction === f ? FACTION_COLORS[f] : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                {FACTION_ICONS[f] && <img src={FACTION_ICONS[f]} alt={f} className="w-3 h-3 object-contain" />}
                <span className="hidden sm:inline">{FACTION_NAMES[f]}</span>
                <span className="sm:hidden">{f}</span>
              </button>
            ))}
          </div>
          <div className="px-4 py-2 border-b border-gray-800 flex items-center gap-2 shrink-0 bg-gray-950">
            <span className="text-xs text-gray-500 mr-auto">
              {new Set(poolRefs).size} unique{poolRefs.length !== new Set(poolRefs).size && ` · ${poolRefs.length} total`}
            </span>
            <span className="text-xs text-gray-500">Group by:</span>
            {['faction', 'type', 'cost', 'set'].map(s => (
              <button key={s} onClick={() => setSortBy(s)}
                className={`px-2.5 py-1 rounded text-xs capitalize transition-colors ${sortBy === s ? 'bg-amber-500 text-gray-950 font-bold' : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}>
                {s}
              </button>
            ))}
          </div>
          <div className="overflow-y-auto flex-1 p-4 space-y-5">
            <GroupedPool refs={poolRefs} cardMap={cardMap} sortBy={sortBy} loading={loading}
              deck={deck} poolCounts={poolCounts} onAdd={addToDeck} onRemove={removeFromDeck} />
          </div>
        </div>
      )}

      {/* DECK TAB */}
      {tab === 'deck' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Validity banner */}
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

          {deckTotal === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
              No cards in deck yet — use + on cards to add them.
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-5">
                <DeckList deck={deck} cardMap={cardMap} onRemove={removeFromDeck} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* STATS TAB — stats of the full pool, or deck if deck is non-empty */}
      {tab === 'stats' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {deckTotal > 0 && (
            <div className="flex border-b border-gray-800 shrink-0">
              {[['pool', 'Full Pool'], ['deck', 'Deck']].map(([id, label]) => (
                <button key={id} onClick={() => setSortBy(id)}
                  className={`flex-1 py-2 text-sm transition-colors ${sortBy === id ? 'text-amber-400 border-b-2 border-amber-400' : 'text-gray-500 hover:text-gray-300'}`}>
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            <DraftStats pickedRefs={sortBy === 'deck' && deckTotal > 0 ? deckRefs : allRefs} cardMap={cardMap} />
          </div>
        </div>
      )}

      {/* Other players footer */}
      {roomState.players.length > 1 && (
        <div className="border-t border-gray-800 bg-gray-900 px-4 py-2 flex flex-wrap gap-2 shrink-0">
          {roomState.players.map((player, i) => {
            const packs = roomState.sealedPacks?.[String(i)] ?? []
            const count = packs.flat().length
            return (
              <div key={player.id} className="flex items-center gap-1.5 text-xs bg-gray-800 rounded-lg px-3 py-1.5">
                <span className={player.id === me.id ? 'text-amber-400 font-medium' : 'text-gray-300'}>{player.name}</span>
                <span className="text-gray-500">{count} cards</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Deck list (grouped by faction, with remove buttons) ───────────────────
function DeckList({ deck, cardMap, onRemove }) {
  const groups = {}
  for (const [ref, qty] of Object.entries(deck)) {
    const card = cardMap[ref]
    const key = card?.cardType === 'HERO' ? 'HERO' : (card?.faction ?? '??')
    if (!groups[key]) groups[key] = []
    groups[key].push({ ref, qty, card })
  }

  const order = ['HERO', ...FACTIONS]

  return (
    <div className="space-y-4">
      {order.filter(k => groups[k]).map(key => {
        const isHero = key === 'HERO'
        const factionCls = isHero
          ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
          : FACTION_COLORS[key] ?? 'text-gray-300 bg-gray-800 border-gray-700'
        const total = groups[key].reduce((a, { qty }) => a + qty, 0)
        return (
          <div key={key}>
            <div className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded border mb-2 ${factionCls}`}>
              {FACTION_ICONS[key] && <img src={FACTION_ICONS[key]} alt="" className="w-3.5 h-3.5 object-contain" />}
              {isHero ? 'Hero' : FACTION_NAMES[key] ?? key}
              <span className="opacity-60">({total})</span>
            </div>
            <div className="space-y-1">
              {groups[key]
                .sort((a, b) => (a.card?.name ?? '').localeCompare(b.card?.name ?? ''))
                .map(({ ref, qty, card }) => (
                  <div key={ref} className="flex items-center gap-2 py-0.5">
                    <span className="w-6 text-center text-amber-400 font-bold text-sm shrink-0">{qty}</span>
                    <span className="text-gray-300 text-sm flex-1 truncate">{card?.name ?? ref}</span>
                    {card?.cardType !== 'HERO' && RARITY_GEMS[card?.rarity] && (
                      <img src={RARITY_GEMS[card.rarity]} alt="" className="w-3.5 h-3.5 object-contain shrink-0" />
                    )}
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

// ─── GroupedPool ────────────────────────────────────────────────────────────
const TYPE_LABEL = {
  HERO: 'Hero', CHARACTER: 'Character', SPELL: 'Spell',
  PERMANENT: 'Permanent', LANDMARK_PERMANENT: 'Permanent', EXPEDITION_PERMANENT: 'Permanent',
}
const TYPE_ORDER = ['Hero', 'Character', 'Spell', 'Permanent']

function GroupedPool({ refs, cardMap, sortBy, loading, deck, poolCounts, onAdd, onRemove }) {
  const cards = refs.map(r => ({ ref: r, card: cardMap[r] }))

  function buildGroups() {
    if (sortBy === 'faction') {
      const buckets = {}
      for (const f of ['HERO', ...FACTIONS]) buckets[f] = []
      for (const { ref, card } of cards) {
        const key = card?.cardType === 'HERO' ? 'HERO' : (card?.faction ?? '??')
        ;(buckets[key] = buckets[key] ?? []).push(ref)
      }
      return Object.entries(buckets).filter(([, v]) => v.length).map(([key, refs]) => ({
        key, label: key === 'HERO' ? 'Hero' : (FACTION_NAMES[key] ?? key),
        icon: FACTION_ICONS[key] ?? null,
        colorCls: FACTION_COLORS[key] ?? (key === 'HERO' ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' : 'text-gray-400 bg-gray-800 border-gray-700'),
        refs,
      }))
    }
    if (sortBy === 'type') {
      const buckets = {}
      for (const { ref, card } of cards) {
        const label = TYPE_LABEL[card?.cardType] ?? (card?.cardType ?? '?')
        ;(buckets[label] = buckets[label] ?? []).push(ref)
      }
      return TYPE_ORDER.filter(t => buckets[t]).map(label => ({
        key: label, label, icon: null, colorCls: 'text-gray-300 bg-gray-800 border-gray-700', refs: buckets[label],
      }))
    }
    if (sortBy === 'cost') {
      const heroes = [], buckets = {}
      for (const { ref, card } of cards) {
        if (card?.cardType === 'HERO') { heroes.push(ref); continue }
        const cost = card?.mainCost != null ? String(card.mainCost) : '—'
        ;(buckets[cost] = buckets[cost] ?? []).push(ref)
      }
      const groups = Object.entries(buckets)
        .sort(([a], [b]) => a === '—' ? 1 : b === '—' ? -1 : Number(a) - Number(b))
        .map(([cost, refs]) => ({
          key: cost, label: cost === '—' ? 'No cost' : `Cost ${cost}`, icon: null,
          colorCls: 'text-gray-300 bg-gray-800 border-gray-700', refs,
        }))
      if (heroes.length) groups.unshift({ key: 'HERO', label: 'Hero', icon: null, colorCls: 'text-amber-400 bg-amber-500/10 border-amber-500/30', refs: heroes })
      return groups
    }
    if (sortBy === 'set') {
      const buckets = {}
      for (const { ref } of cards) {
        const rawSet = ref.split('_')[1] ?? '?'
        const abbrev = SET_ABBREV[rawSet] ?? rawSet
        ;(buckets[abbrev] = buckets[abbrev] ?? []).push(ref)
      }
      const setOrder = ['BTG', 'TBF', 'WTM', 'SKY', 'SDU', 'ROC', 'NEJ']
      return Object.entries(buckets)
        .sort(([a], [b]) => (setOrder.indexOf(a) + 1 || 99) - (setOrder.indexOf(b) + 1 || 99))
        .map(([abbrev, refs]) => {
          const iconCode = SET_ABBREV_ICON_CODE[abbrev]
          return { key: abbrev, label: abbrev, icon: iconCode ? SET_ICONS[iconCode] : null, colorCls: 'text-gray-300 bg-gray-800 border-gray-700', refs }
        })
    }
    return []
  }

  const groups = buildGroups()
  return (
    <div className="space-y-5">
      {groups.map(group => (
        <div key={group.key}>
          <div className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded border mb-2 ${group.colorCls}`}>
            {group.icon && <img src={group.icon} alt="" className="w-3.5 h-3.5 object-contain" onError={e => { e.currentTarget.style.display = 'none' }} />}
            {group.label} <span className="opacity-60">({new Set(group.refs).size})</span>
          </div>
          <CardPool refs={group.refs} cardMap={cardMap} loading={loading}
            deck={deck} poolCounts={poolCounts} onAdd={onAdd} onRemove={onRemove} />
        </div>
      ))}
    </div>
  )
}

// ─── CardPool ───────────────────────────────────────────────────────────────
function CardPool({ refs, cardMap, loading, deck, poolCounts, onAdd, onRemove }) {
  const seen = new Map()
  for (const ref of refs) seen.set(ref, (seen.get(ref) ?? 0) + 1)
  const unique = [...seen.entries()]

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
      {unique.map(([ref, poolQty]) => {
        const card = cardMap[ref]
        const inDeck = deck[ref] ?? 0
        const canAdd = inDeck < poolQty
        const canRemove = inDeck > 0

        return (
          <div key={ref} className="relative flex flex-col rounded-lg overflow-hidden border border-gray-700 bg-gray-900 group">
            <div className="aspect-[2/3] bg-gray-800 overflow-hidden relative">
              {card?.imagePath ? (
                <img src={card.imagePath} alt={card?.name} className="w-full h-full object-cover" loading="lazy"
                  onError={e => { e.currentTarget.style.display = 'none' }} />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-1">
                  <span className="text-xs text-gray-600 text-center leading-tight">{loading ? '…' : (card?.name ?? ref)}</span>
                </div>
              )}

              {/* Pool qty badge (only if >1) */}
              {poolQty > 1 && (
                <div className="absolute top-1 left-1 bg-gray-900/90 text-gray-400 font-bold text-xs px-1 py-0.5 rounded border border-gray-600">
                  ×{poolQty}
                </div>
              )}

              {/* Deck +/- controls — shown on hover or when in deck */}
              <div className={`absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1 px-1 py-1.5 bg-black/70
                transition-opacity ${inDeck > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                <button onClick={() => onRemove(ref)} disabled={!canRemove}
                  className="w-7 h-7 rounded bg-gray-700 hover:bg-red-800 disabled:opacity-30 text-white font-bold flex items-center justify-center transition-colors">
                  −
                </button>
                <span className={`w-6 text-center text-sm font-bold ${inDeck > 0 ? 'text-amber-400' : 'text-gray-500'}`}>
                  {inDeck}
                </span>
                <button onClick={() => onAdd(ref)} disabled={!canAdd}
                  className="w-7 h-7 rounded bg-gray-700 hover:bg-green-800 disabled:opacity-30 text-white font-bold flex items-center justify-center transition-colors">
                  +
                </button>
              </div>
            </div>

            <div className="p-1">
              <p className="text-xs text-gray-300 leading-tight line-clamp-1">{card?.name ?? ''}</p>
              <div className="flex items-center gap-1 mt-0.5">
                {FACTION_ICONS[card?.faction] && (
                  <img src={FACTION_ICONS[card.faction]} alt="" className="w-3 h-3 object-contain" />
                )}
                {card?.cardType !== 'HERO' && RARITY_GEMS[card?.rarity] && (
                  <img src={RARITY_GEMS[card.rarity]} alt={card.rarity} className="w-3 h-3 object-contain ml-auto" />
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
