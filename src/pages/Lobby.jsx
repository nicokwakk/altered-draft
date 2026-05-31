import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { fetchSet, SETS } from '../lib/cardData.js'
import { generateAllPacks, generatePacksFromPool } from '../lib/packGenerator.js'
import { buildInitialState } from '../lib/draftLogic.js'
import SetSelector from '../components/SetSelector.jsx'

const LANGS = ['EN', 'FR', 'ES', 'DE', 'IT']

export default function Lobby() {
  const { code } = useParams()
  const navigate = useNavigate()

  const [roomState, setRoomState] = useState(null)
  const [me, setMe] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [startError, setStartError] = useState('')
  const [showCustomPool, setShowCustomPool] = useState(false)
  const [customPoolText, setCustomPoolText] = useState('')

  // Config controlled by host
  const [selectedSets, setSelectedSets] = useState({ CORE: 1 })
  const [lang, setLang] = useState('EN')
  const [playerCount, setPlayerCount] = useState(4)

  useEffect(() => {
    const stored = sessionStorage.getItem(`player_${code}`)
    if (!stored) { navigate('/'); return }
    setMe(JSON.parse(stored))
  }, [code, navigate])

  // Initial load
  useEffect(() => {
    supabase.from('draft_rooms').select('state').eq('id', code).single()
      .then(({ data, error: e }) => {
        if (e || !data) { navigate('/'); return }
        setRoomState(data.state)
        if (data.state.phase !== 'lobby') {
          navigate(`/room/${code}/draft`)
        }
      })
  }, [code, navigate])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`room-${code}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'draft_rooms', filter: `id=eq.${code}` },
        payload => {
          const state = payload.new.state
          setRoomState(state)
          if (state.phase === 'drafting') navigate(`/room/${code}/draft`)
        })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [code, navigate])

  const handleStart = useCallback(async () => {
    if (!roomState) return
    if (roomState.players.length < 2) { setStartError('Need at least 2 players to start.'); return }
    setLoading(true)
    setStartError('')

    try {
      let allCards = []

      if (customPoolText.trim()) {
        // Custom pool mode
        const refs = customPoolText.trim().split(/\s+/).filter(Boolean)
        allCards = refs.map(r => ({ reference: r, cardType: '', faction: 'XX', rarity: 'C', name: r, imagePath: null }))
        const packs = generatePacksFromPool(refs, roomState.players.length, 4)
        const state = buildInitialState(
          { sets: [], playerCount: roomState.players.length, lang, customPool: true },
          roomState.players,
          packs
        )
        await supabase.from('draft_rooms').update({ state }).eq('id', code)
      } else {
        const setCodes = Object.keys(selectedSets).filter(k => selectedSets[k] > 0)
        if (!setCodes.length) { setStartError('Select at least one set.'); setLoading(false); return }

        const fetchPromises = setCodes.map(s => fetchSet(s, lang))
        const results = await Promise.all(fetchPromises)
        allCards = results.flat()

        if (!allCards.length) { setStartError('No cards loaded. Check set selection.'); setLoading(false); return }

        const packs = generateAllPacks(allCards, roomState.players.length, 4)
        const state = buildInitialState(
          { sets: setCodes, playerCount: roomState.players.length, lang },
          roomState.players,
          packs
        )
        await supabase.from('draft_rooms').update({ state }).eq('id', code)
      }
    } catch (err) {
      setStartError('Error starting draft: ' + err.message)
      setLoading(false)
    }
  }, [roomState, selectedSets, lang, customPoolText, code])

  if (!roomState || !me) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading room…</div>
  }

  const isHost = me.isHost

  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-4">
      <div className="max-w-2xl w-full space-y-6">

        {/* Room code banner */}
        <div className="bg-gray-900 rounded-xl p-6 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Room code</p>
          <p className="text-5xl font-mono font-bold tracking-widest text-amber-400">{code}</p>
          <p className="text-sm text-gray-500 mt-2">Share this code with other players</p>
        </div>

        {/* Players list */}
        <div className="bg-gray-900 rounded-xl p-6">
          <h2 className="font-semibold mb-3 text-gray-300">Players ({roomState.players.length})</h2>
          <ul className="space-y-2">
            {roomState.players.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 text-sm">
                <span className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold">
                  {i + 1}
                </span>
                <span className="font-medium">{p.name}</span>
                {i === 0 && <span className="text-xs text-amber-400 ml-auto">Host</span>}
                {p.id === me.id && <span className="text-xs text-gray-500 ml-auto">You</span>}
              </li>
            ))}
          </ul>
          {roomState.players.length < 2 && (
            <p className="text-xs text-gray-500 mt-3">Waiting for more players to join…</p>
          )}
        </div>

        {/* Draft config — host only */}
        {isHost && (
          <div className="bg-gray-900 rounded-xl p-6 space-y-5">
            <h2 className="font-semibold text-gray-300">Draft configuration</h2>

            <SetSelector
              selectedSets={selectedSets}
              onChange={setSelectedSets}
              disabled={loading}
            />

            <div>
              <label className="block text-sm text-gray-400 mb-2">Card language</label>
              <div className="flex gap-2 flex-wrap">
                {LANGS.map(l => (
                  <button key={l} onClick={() => setLang(l)}
                    className={`px-3 py-1 rounded text-sm font-mono transition-colors ${lang === l
                      ? 'bg-amber-500 text-gray-950 font-bold'
                      : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom pool */}
            <div>
              <button
                onClick={() => setShowCustomPool(!showCustomPool)}
                className="text-sm text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-1"
              >
                <span className="text-xs">{showCustomPool ? '▼' : '▶'}</span>
                Custom card pool (advanced)
              </button>
              {showCustomPool && (
                <div className="mt-3">
                  <p className="text-xs text-gray-500 mb-2">
                    Paste card references (one per line). Overrides set selection if non-empty.
                  </p>
                  <textarea
                    value={customPoolText}
                    onChange={e => setCustomPoolText(e.target.value)}
                    rows={6}
                    placeholder="ALT_CORE_B_AX_02_C&#10;ALT_CORE_B_BR_03_R1&#10;..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-amber-500 resize-none"
                  />
                </div>
              )}
            </div>

            {startError && <p className="text-red-400 text-sm">{startError}</p>}

            <button
              onClick={handleStart}
              disabled={loading || roomState.players.length < 2}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-gray-950 font-bold rounded-lg transition-colors"
            >
              {loading ? 'Generating packs…' : 'Start draft'}
            </button>
          </div>
        )}

        {!isHost && (
          <div className="bg-gray-900 rounded-xl p-6 text-center text-gray-400 text-sm">
            Waiting for the host to start the draft…
          </div>
        )}
      </div>
    </div>
  )
}
