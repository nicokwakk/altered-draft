import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { fetchSet, apiSetCode, FACTIONS, FACTION_NAMES, FACTION_COLORS, SET_ABBREV } from '../lib/cardData.js'
import { FACTION_ICONS, RARITY_GEMS, SET_ICONS, SET_ABBREV_ICON_CODE } from '../lib/assets.js'
import { buildDecklist } from '../lib/exportFormat.js'
import ExportButton from '../components/ExportButton.jsx'
import DraftStats from '../components/DraftStats.jsx'

export default function Sealed() {
  const { code } = useParams()
  const navigate = useNavigate()

  const [roomState, setRoomState] = useState(null)
  const [me, setMe] = useState(null)
  const [cardMap, setCardMap] = useState({})
  const [packIndex, setPackIndex] = useState(0)   // current booster (0-6)
  const [tab, setTab] = useState('booster')        // 'booster' | 'pool' | 'favorites'
  const [favorites, setFavorites] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [filterFaction, setFilterFaction] = useState('ALL')
  const [sortBy, setSortBy] = useState('faction') // 'faction' | 'type' | 'cost' | 'set'

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

  // Load favorites from localStorage
  useEffect(() => {
    if (!me) return
    const stored = localStorage.getItem(`sealed_fav_${code}_${me.id}`)
    if (stored) setFavorites(new Set(JSON.parse(stored)))
  }, [me, code])

  function toggleFavorite(ref) {
    setFavorites(prev => {
      const next = new Set(prev)
      next.has(ref) ? next.delete(ref) : next.add(ref)
      localStorage.setItem(`sealed_fav_${code}_${me.id}`, JSON.stringify([...next]))
      return next
    })
  }

  if (!roomState || !me) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>

  const myIndex = roomState.players.findIndex(p => p.id === me.id)
  // Support both old sealedPools (flat) and new sealedPacks (array of arrays)
  const myPacks = roomState.sealedPacks?.[String(myIndex)]
    ?? (roomState.sealedPools?.[String(myIndex)] ? [roomState.sealedPools[String(myIndex)]] : [])
  const totalPacks = myPacks.length
  const allRefs = myPacks.flat()
  const decklist = buildDecklist(allRefs, cardMap)

  const currentPack = myPacks[packIndex] ?? []
  const favoriteRefs = allRefs.filter(r => favorites.has(r))
  const poolRefs = filterFaction === 'ALL'
    ? allRefs
    : allRefs.filter(r => cardMap[r]?.faction === filterFaction || cardMap[r]?.cardType === 'HERO')

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center gap-3 shrink-0">
        <span className="font-mono text-amber-400 font-bold text-sm">{code}</span>
        <span className="text-gray-400 text-sm">Sealed</span>
        <div className="ml-auto">
          <ExportButton decklist={decklist} />
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-gray-900 border-b border-gray-800 flex shrink-0">
        {[
          { id: 'booster', label: `Boosters (${totalPacks})` },
          { id: 'pool',    label: `Full Pool (${allRefs.length})` },
          { id: 'favorites', label: `❤️ Favorites (${favorites.size})` },
      { id: 'stats',     label: 'Stats' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 text-sm transition-colors ${
              tab === t.id ? 'text-amber-400 border-b-2 border-amber-400' : 'text-gray-500 hover:text-gray-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* BOOSTER TAB */}
      {tab === 'booster' && (
        <div className="flex-1 overflow-y-auto">
          {/* Pack navigator */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
            <button onClick={() => setPackIndex(i => Math.max(0, i - 1))}
              disabled={packIndex === 0}
              className="w-8 h-8 rounded-lg bg-gray-800 disabled:opacity-30 flex items-center justify-center text-gray-300 hover:bg-gray-700 transition-colors">
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
            <button onClick={() => setPackIndex(i => Math.min(totalPacks - 1, i + 1))}
              disabled={packIndex === totalPacks - 1}
              className="w-8 h-8 rounded-lg bg-gray-800 disabled:opacity-30 flex items-center justify-center text-gray-300 hover:bg-gray-700 transition-colors">
              ›
            </button>
          </div>

          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Booster {packIndex + 1} <span className="text-gray-500 text-sm font-normal">· {currentPack.length} cards</span></h2>
            </div>
            <CardPool refs={currentPack} cardMap={cardMap} loading={loading}
              favorites={favorites} onToggleFavorite={toggleFavorite} />
          </div>
        </div>
      )}

      {/* FULL POOL TAB */}
      {tab === 'pool' && (
        <div className="flex-1 overflow-y-auto flex flex-col">
          {/* Controls */}
          <div className="px-4 py-2 border-b border-gray-800 flex flex-wrap gap-2 items-center shrink-0">
            {/* Faction filter */}
            <div className="flex gap-1 flex-wrap flex-1">
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
            {/* Sort */}
            <div className="flex gap-1 shrink-0">
              {['faction', 'type', 'cost', 'set'].map(s => (
                <button key={s} onClick={() => setSortBy(s)}
                  className={`px-2 py-1 rounded text-xs capitalize transition-colors ${sortBy === s ? 'bg-amber-500 text-gray-950 font-bold' : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-y-auto flex-1 p-4 space-y-5">
            <p className="text-xs text-gray-500">{poolRefs.length} cards</p>
            <GroupedPool refs={poolRefs} cardMap={cardMap} sortBy={sortBy}
              loading={loading} favorites={favorites} onToggleFavorite={toggleFavorite} />
          </div>
        </div>
      )}

      {/* FAVORITES TAB */}
      {tab === 'favorites' && (
        <div className="flex-1 overflow-y-auto p-4">
          {favoriteRefs.length === 0
            ? <p className="text-gray-500 text-sm text-center py-12">No favorites yet — click ❤️ on any card.</p>
            : <CardPool refs={favoriteRefs} cardMap={cardMap} loading={loading}
                favorites={favorites} onToggleFavorite={toggleFavorite} />}
        </div>
      )}

      {/* STATS TAB */}
      {tab === 'stats' && (
        <div className="flex-1 overflow-y-auto">
          <DraftStats pickedRefs={allRefs} cardMap={cardMap} />
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

const TYPE_LABEL = {
  HERO: 'Hero', CHARACTER: 'Character', SPELL: 'Spell',
  PERMANENT: 'Permanent', LANDMARK_PERMANENT: 'Permanent', EXPEDITION_PERMANENT: 'Permanent',
}
const TYPE_ORDER = ['Hero', 'Character', 'Spell', 'Permanent']

// Groups a flat list of refs by sortBy and renders labeled sections
function GroupedPool({ refs, cardMap, sortBy, loading, favorites, onToggleFavorite }) {
  const cards = refs.map(r => ({ ref: r, card: cardMap[r] }))

  function buildGroups() {
    if (sortBy === 'faction') {
      const buckets = {}
      for (const f of ['HERO', ...FACTIONS]) buckets[f] = []
      for (const { ref, card } of cards) {
        const key = card?.cardType === 'HERO' ? 'HERO' : (card?.faction ?? '??')
        ;(buckets[key] = buckets[key] ?? []).push(ref)
      }
      return Object.entries(buckets)
        .filter(([, v]) => v.length)
        .map(([key, refs]) => ({
          key,
          label: key === 'HERO' ? 'Hero' : (FACTION_NAMES[key] ?? key),
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
        key: label, label, icon: null,
        colorCls: 'text-gray-300 bg-gray-800 border-gray-700',
        refs: buckets[label],
      }))
    }
    if (sortBy === 'cost') {
      const buckets = {}
      for (const { ref, card } of cards) {
        const cost = card?.mainCost != null ? String(card.mainCost) : '—'
        ;(buckets[cost] = buckets[cost] ?? []).push(ref)
      }
      return Object.entries(buckets)
        .sort(([a], [b]) => a === '—' ? 1 : b === '—' ? -1 : Number(a) - Number(b))
        .map(([cost, refs]) => ({
          key: cost, label: cost === '—' ? 'No cost' : `Cost ${cost}`, icon: null,
          colorCls: 'text-gray-300 bg-gray-800 border-gray-700',
          refs,
        }))
    }
    if (sortBy === 'set') {
      const buckets = {}
      for (const { ref, card } of cards) {
        const rawSet = ref.split('_')[1] ?? '?'
        const abbrev = SET_ABBREV[rawSet] ?? rawSet
        ;(buckets[abbrev] = buckets[abbrev] ?? []).push(ref)
      }
      const setOrder = ['BTG', 'TBF', 'WTM', 'SKY', 'SDU', 'ROC', 'NEJ']
      return Object.entries(buckets)
        .sort(([a], [b]) => (setOrder.indexOf(a) + 1 || 99) - (setOrder.indexOf(b) + 1 || 99))
        .map(([abbrev, refs]) => {
          const iconCode = SET_ABBREV_ICON_CODE[abbrev]
          return {
            key: abbrev, label: abbrev,
            icon: iconCode ? SET_ICONS[iconCode] : null,
            colorCls: 'text-gray-300 bg-gray-800 border-gray-700',
            refs,
          }
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
            {group.icon && (
              <img src={group.icon} alt="" className="w-3.5 h-3.5 object-contain"
                onError={e => { e.currentTarget.style.display = 'none' }} />
            )}
            {group.label}
            <span className="opacity-60">({group.refs.length})</span>
          </div>
          <CardPool refs={group.refs} cardMap={cardMap} loading={loading}
            favorites={favorites} onToggleFavorite={onToggleFavorite} />
        </div>
      ))}
    </div>
  )
}

// Reusable card pool grid with favorite toggle
function CardPool({ refs, cardMap, loading, favorites, onToggleFavorite }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
      {refs.map(ref => {
        const card = cardMap[ref]
        const isFav = favorites.has(ref)
        return (
          <div key={ref} className="relative flex flex-col rounded-lg overflow-hidden border border-gray-700 bg-gray-900 group">
            <div className="aspect-[2/3] bg-gray-800 overflow-hidden">
              {card?.imagePath ? (
                <img src={card.imagePath} alt={card?.name} className="w-full h-full object-cover" loading="lazy"
                  onError={e => { e.currentTarget.style.display = 'none' }} />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-1">
                  <span className="text-xs text-gray-600 text-center leading-tight">
                    {loading ? '…' : (card?.name ?? ref)}
                  </span>
                </div>
              )}
            </div>

            {/* Favorite button */}
            <button
              onClick={() => onToggleFavorite(ref)}
              className={`absolute top-1 right-1 w-8 h-8 rounded-full flex items-center justify-center text-base
                transition-all shadow-md
                ${isFav
                  ? 'bg-red-500 text-white opacity-100'
                  : 'bg-black/60 text-white opacity-0 group-hover:opacity-100'}`}>
              {isFav ? '❤️' : '♡'}
            </button>

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
