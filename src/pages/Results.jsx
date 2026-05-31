import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { fetchSet } from '../lib/cardData.js'
import { buildDecklist, groupPicksByFaction } from '../lib/exportFormat.js'
import { FACTIONS, FACTION_NAMES, FACTION_COLORS } from '../lib/cardData.js'
import { FACTION_ICONS } from '../lib/assets.js'
import ExportButton from '../components/ExportButton.jsx'

export default function Results() {
  const { code } = useParams()
  const navigate = useNavigate()

  const [roomState, setRoomState] = useState(null)
  const [me, setMe] = useState(null)
  const [cardMap, setCardMap] = useState({})

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
          const maps = {}
          await Promise.all(data.state.config.sets.map(async s => {
            const cards = await fetchSet(s, data.state.config.lang || 'EN').catch(() => [])
            for (const c of cards) maps[c.reference] = c
          }))
          setCardMap(maps)
        }
      })
  }, [code, navigate])

  if (!roomState || !me) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading results…</div>
  }

  const myIndex = roomState.players.findIndex(p => p.id === me.id)
  const myPicks = roomState.picks[String(myIndex)] ?? []
  const decklist = buildDecklist(myPicks, cardMap)
  const grouped = groupPicksByFaction(myPicks, cardMap)

  return (
    <div className="min-h-screen py-10 px-4">
      <div className="max-w-5xl mx-auto space-y-8">

        <div className="text-center">
          <h1 className="text-3xl font-bold text-amber-400 mb-1">Draft Complete</h1>
          <p className="text-gray-400 text-sm">Room {code} · {myPicks.length} cards drafted</p>
        </div>

        {/* My decklist */}
        <div className="bg-gray-900 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">Your Decklist</h2>
            <div className="flex gap-3">
              <ExportButton decklist={decklist} />
              <a
                href="https://altered.re/pages/decks"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm rounded-lg transition-colors text-gray-300"
              >
                Open altered.re ↗
              </a>
            </div>
          </div>

          {/* Hero */}
          {grouped.HERO && (
            <div className="mb-4">
              <h3 className="text-xs uppercase tracking-widest text-amber-400 mb-2">Hero</h3>
              <div className="space-y-1">
                {Object.entries(grouped.HERO).map(([ref, qty]) => (
                  <div key={ref} className="flex items-center gap-2 text-sm">
                    <span className="w-6 text-center text-amber-400 font-bold">{qty}</span>
                    <span className="text-gray-300">{cardMap[ref]?.name ?? ref}</span>
                    <span className="text-xs text-gray-600 font-mono ml-auto">{ref}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* By faction */}
          {FACTIONS.map(f => {
            const group = grouped[f]
            if (!group) return null
            const total = Object.values(group).reduce((a, b) => a + b, 0)
            return (
              <div key={f} className="mb-4">
                <h3 className={`text-xs mb-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded border ${FACTION_COLORS[f]}`}>
                  {FACTION_ICONS[f] && <img src={FACTION_ICONS[f]} alt="" className="w-4 h-4 object-contain" />}
                  {FACTION_NAMES[f] ?? f} ({total})
                </h3>
                <div className="space-y-1">
                  {Object.entries(group)
                    .sort((a, b) => (cardMap[a[0]]?.name ?? '').localeCompare(cardMap[b[0]]?.name ?? ''))
                    .map(([ref, qty]) => (
                      <div key={ref} className="flex items-center gap-2 text-sm">
                        <span className="w-6 text-center font-bold text-gray-400">{qty}</span>
                        <span className="text-gray-300">{cardMap[ref]?.name ?? ref}</span>
                        <span className="text-xs text-gray-600 font-mono ml-auto">{ref}</span>
                      </div>
                    ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Other players summary */}
        <div className="bg-gray-900 rounded-xl p-6">
          <h2 className="font-semibold text-lg mb-4">All players</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {roomState.players.map((player, i) => {
              const picks = roomState.picks[String(i)] ?? []
              const factionCounts = {}
              for (const ref of picks) {
                const card = cardMap[ref]
                if (!card || card.cardType === 'HERO') continue
                factionCounts[card.faction] = (factionCounts[card.faction] ?? 0) + 1
              }
              return (
                <div key={player.id} className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="font-medium">{player.name}</span>
                    {player.id === me.id && <span className="text-xs text-amber-400">(you)</span>}
                    <span className="ml-auto text-xs text-gray-500">{picks.length} cards</span>
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
      </div>
    </div>
  )
}
