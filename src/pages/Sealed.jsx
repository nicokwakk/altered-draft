import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { fetchSet, apiSetCode, FACTIONS, FACTION_NAMES, FACTION_COLORS } from '../lib/cardData.js'
import { FACTION_ICONS, RARITY_GEMS } from '../lib/assets.js'
import { buildDecklist } from '../lib/exportFormat.js'
import ExportButton from '../components/ExportButton.jsx'

const TYPE_ORDER = ['HERO', 'CHARACTER', 'SPELL', 'LANDMARK_PERMANENT', 'EXPEDITION_PERMANENT']
const TYPE_LABELS = {
  HERO: 'Hero', CHARACTER: 'Character', SPELL: 'Spell',
  LANDMARK_PERMANENT: 'Permanent', EXPEDITION_PERMANENT: 'Permanent',
}

export default function Sealed() {
  const { code } = useParams()
  const navigate = useNavigate()

  const [roomState, setRoomState] = useState(null)
  const [me, setMe] = useState(null)
  const [cardMap, setCardMap] = useState({})
  const [filterFaction, setFilterFaction] = useState('ALL')
  const [sortBy, setSortBy] = useState('faction') // 'faction' | 'type' | 'cost'
  const [loading, setLoading] = useState(true)

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

  if (!roomState || !me) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>

  const myIndex = roomState.players.findIndex(p => p.id === me.id)
  const myPool = roomState.sealedPools?.[String(myIndex)] ?? []
  const decklist = buildDecklist(myPool, cardMap)

  // Group cards for display
  const cards = myPool.map(ref => cardMap[ref]).filter(Boolean)
  const filtered = filterFaction === 'ALL' ? cards : cards.filter(c => c.faction === filterFaction || c.cardType === 'HERO')

  function groupCards() {
    if (sortBy === 'faction') {
      const groups = {}
      for (const f of ['HERO', ...FACTIONS]) groups[f] = []
      for (const c of filtered) {
        const key = c.cardType === 'HERO' ? 'HERO' : c.faction
        if (groups[key]) groups[key].push(c)
      }
      return Object.entries(groups).filter(([, v]) => v.length)
    }
    if (sortBy === 'type') {
      const groups = {}
      for (const c of filtered) {
        const label = TYPE_LABELS[c.cardType] ?? c.cardType
        if (!groups[label]) groups[label] = []
        groups[label].push(c)
      }
      return TYPE_ORDER
        .map(t => [TYPE_LABELS[t] ?? t, groups[TYPE_LABELS[t]] ?? []])
        .filter(([, v]) => v.length)
        // dedupe (Permanent appears twice in TYPE_LABELS)
        .filter(([k], i, arr) => arr.findIndex(([x]) => x === k) === i)
    }
    if (sortBy === 'cost') {
      const groups = {}
      for (const c of filtered) {
        const cost = c.mainCost != null ? String(c.mainCost) : '—'
        if (!groups[cost]) groups[cost] = []
        groups[cost].push(c)
      }
      return Object.entries(groups).sort((a, b) => {
        if (a[0] === '—') return 1
        if (b[0] === '—') return -1
        return Number(a[0]) - Number(b[0])
      })
    }
    return []
  }

  const groups = groupCards()

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <span className="font-mono text-amber-400 font-bold">{code}</span>
        <span className="text-gray-400 text-sm">Sealed Pool</span>
        <span className="text-gray-500 text-xs ml-1">· {myPool.length} cards</span>
        <div className="ml-auto">
          <ExportButton decklist={decklist} />
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gray-900/50 border-b border-gray-800 px-4 py-2 flex flex-wrap gap-3 items-center">
        {/* Faction filter */}
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setFilterFaction('ALL')}
            className={`px-2 py-1 rounded text-xs transition-colors ${filterFaction === 'ALL' ? 'bg-gray-600 text-gray-100' : 'text-gray-500 hover:text-gray-300'}`}>
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

        <div className="flex gap-1 ml-auto">
          {['faction', 'type', 'cost'].map(s => (
            <button key={s} onClick={() => setSortBy(s)}
              className={`px-2.5 py-1 rounded text-xs capitalize transition-colors ${sortBy === s ? 'bg-amber-500 text-gray-950 font-bold' : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Card pool */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {loading && <div className="text-gray-500 text-sm text-center py-8">Loading card data…</div>}
        {!loading && groups.map(([groupKey, groupCards]) => {
          const isFactionGroup = FACTIONS.includes(groupKey)
          const isHeroGroup = groupKey === 'HERO'
          const factionCls = isFactionGroup ? FACTION_COLORS[groupKey] : isHeroGroup ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' : 'text-gray-300 bg-gray-800 border-gray-700'

          return (
            <div key={groupKey}>
              <h3 className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded border mb-2 ${factionCls}`}>
                {FACTION_ICONS[groupKey] && (
                  <img src={FACTION_ICONS[groupKey]} alt="" className="w-3.5 h-3.5 object-contain" />
                )}
                {isHeroGroup ? 'Hero' : isFactionGroup ? FACTION_NAMES[groupKey] : groupKey}
                <span className="opacity-60">({groupCards.length})</span>
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                {groupCards.map(card => (
                  <div key={card.reference} className="flex flex-col rounded-lg overflow-hidden border border-gray-700 bg-gray-900">
                    <div className="aspect-[2/3] bg-gray-800 overflow-hidden">
                      {card.imagePath ? (
                        <img src={card.imagePath} alt={card.name} className="w-full h-full object-cover" loading="lazy"
                          onError={e => { e.currentTarget.style.display = 'none' }} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center p-1">
                          <span className="text-xs text-gray-600 text-center leading-tight">{card.name}</span>
                        </div>
                      )}
                    </div>
                    <div className="p-1">
                      <p className="text-xs text-gray-300 leading-tight line-clamp-1">{card.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {FACTION_ICONS[card.faction] && (
                          <img src={FACTION_ICONS[card.faction]} alt="" className="w-3 h-3 object-contain" />
                        )}
                        {card.cardType !== 'HERO' && RARITY_GEMS[card.rarity] && (
                          <img src={RARITY_GEMS[card.rarity]} alt={card.rarity} className="w-3 h-3 object-contain ml-auto" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Other players */}
      <div className="border-t border-gray-800 bg-gray-900 px-4 py-3">
        <p className="text-xs text-gray-500 mb-2">Other players</p>
        <div className="flex flex-wrap gap-2">
          {roomState.players.map((player, i) => {
            const pool = roomState.sealedPools?.[String(i)] ?? []
            return (
              <div key={player.id} className="flex items-center gap-1.5 text-xs bg-gray-800 rounded-lg px-3 py-1.5">
                <span className={player.id === me.id ? 'text-amber-400 font-medium' : 'text-gray-300'}>{player.name}</span>
                <span className="text-gray-500">{pool.length} cards</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
