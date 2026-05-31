import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { fetchSet } from '../lib/cardData.js'
import { generateAllPacks, generatePacksFromPool } from '../lib/packGenerator.js'
import { buildInitialState } from '../lib/draftLogic.js'
import SetSelector from '../components/SetSelector.jsx'

const LANGS = ['EN', 'FR', 'ES', 'DE', 'IT']

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function Lobby() {
  const { code } = useParams()
  const navigate = useNavigate()

  const [roomState, setRoomState] = useState(null)
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(false)
  const [startError, setStartError] = useState('')
  const [showCustomPool, setShowCustomPool] = useState(false)
  const [customPoolText, setCustomPoolText] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)

  // Config controlled by host
  const [selectedSets, setSelectedSets] = useState({ CORE: 1 })
  const [lang, setLang] = useState('EN')
  const [includeHeroes, setIncludeHeroes] = useState(true)

  const joinUrl = `${window.location.origin}/?join=${code}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(joinUrl)}&bgcolor=111827&color=f59e0b`

  useEffect(() => {
    const stored = sessionStorage.getItem(`player_${code}`)
    if (!stored) { navigate('/'); return }
    setMe(JSON.parse(stored))
  }, [code, navigate])

  useEffect(() => {
    supabase.from('draft_rooms').select('state').eq('id', code).single()
      .then(({ data, error }) => {
        if (error || !data) { navigate('/'); return }
        setRoomState(data.state)
        if (data.state.phase !== 'lobby') navigate(`/room/${code}/draft`)
      })
  }, [code, navigate])

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

  async function copyLink() {
    await navigator.clipboard.writeText(joinUrl)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  const handleStart = useCallback(async () => {
    if (!roomState) return
    if (roomState.players.length < 2) { setStartError('Need at least 2 players to start.'); return }
    setLoading(true)
    setStartError('')

    try {
      // Randomize seat order
      const shuffledPlayers = shuffle(roomState.players)

      if (customPoolText.trim()) {
        const refs = customPoolText.trim().split(/\s+/).filter(Boolean)
        const packs = generatePacksFromPool(refs, shuffledPlayers.length, 4)
        const state = buildInitialState(
          { sets: [], playerCount: shuffledPlayers.length, lang, customPool: true, includeHeroes },
          shuffledPlayers,
          packs
        )
        await supabase.from('draft_rooms').update({ state }).eq('id', code)
      } else {
        const setCodes = Object.keys(selectedSets).filter(k => selectedSets[k] > 0)
        if (!setCodes.length) { setStartError('Select at least one set.'); setLoading(false); return }

        const results = await Promise.all(setCodes.map(s => fetchSet(s, lang)))
        const allCards = results.flat()
        if (!allCards.length) { setStartError('No cards loaded. Check set selection.'); setLoading(false); return }

        const packs = generateAllPacks(allCards, shuffledPlayers.length, 4, { includeHeroes })
        const state = buildInitialState(
          { sets: setCodes, playerCount: shuffledPlayers.length, lang, includeHeroes },
          shuffledPlayers,
          packs
        )
        await supabase.from('draft_rooms').update({ state }).eq('id', code)
      }
    } catch (err) {
      setStartError('Error starting draft: ' + err.message)
      setLoading(false)
    }
  }, [roomState, selectedSets, lang, customPoolText, code, includeHeroes])

  if (!roomState || !me) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading room…</div>
  }

  const isHost = me.isHost

  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-4">
      <div className="max-w-2xl w-full space-y-6">

        {/* Room code + share */}
        <div className="bg-gray-900 rounded-xl p-6">
          <div className="flex gap-6 items-center">
            <div className="flex-1">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Room code</p>
              <p className="text-5xl font-mono font-bold tracking-widest text-amber-400">{code}</p>
              <p className="text-sm text-gray-500 mt-2">Share this code or the link below</p>
              <div className="flex gap-2 mt-3">
                <input
                  readOnly
                  value={joinUrl}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-400 font-mono"
                />
                <button
                  onClick={copyLink}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    linkCopied ? 'bg-green-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  }`}
                >
                  {linkCopied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <img src={qrUrl} alt="QR code" className="w-[140px] h-[140px] rounded-lg shrink-0" />
          </div>
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
                {p.id === me.id && <span className="text-xs text-gray-500 ml-1">(you)</span>}
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

            <SetSelector selectedSets={selectedSets} onChange={setSelectedSets} disabled={loading} />

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

            {/* Hero toggle */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="include-heroes"
                checked={includeHeroes}
                onChange={e => setIncludeHeroes(e.target.checked)}
                className="accent-amber-500 w-4 h-4"
              />
              <label htmlFor="include-heroes" className="text-sm text-gray-300 cursor-pointer">
                Include hero cards in packs
              </label>
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
                    placeholder={"ALT_CORE_B_AX_02_C\nALT_CORE_B_BR_03_R1\n..."}
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
