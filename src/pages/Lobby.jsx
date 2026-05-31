import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { fetchSet, SETS } from '../lib/cardData.js'
import { SET_ASSETS } from '../lib/assets.js'
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
  const [linkCopied, setLinkCopied] = useState(false)

  // Config
  const [configTab, setConfigTab] = useState('presets') // 'presets' | 'advanced'
  const [selectedPreset, setSelectedPreset] = useState(null) // set code
  const [selectedSets, setSelectedSets] = useState({ CORE: 1 })
  const [lang, setLang] = useState('EN')
  const [includeHeroes, setIncludeHeroes] = useState(true)
  const [showCustomPool, setShowCustomPool] = useState(false)
  const [customPoolText, setCustomPoolText] = useState('')

  const joinUrl = `${window.location.origin}/?join=${code}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(joinUrl)}&bgcolor=111827&color=f59e0b`

  useEffect(() => {
    const stored = localStorage.getItem(`player_${code}`)
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
    await navigator.clipboard.writeText(joinUrl).catch(() => {})
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  // Resolve which sets/packs to use based on active config tab
  function resolveConfig(playerCount) {
    if (configTab === 'presets') {
      if (!selectedPreset) return null
      // 4 packs of the selected set per player
      return { [selectedPreset]: playerCount }
    }
    return selectedSets
  }

  const handleStart = useCallback(async () => {
    if (!roomState) return
    if (roomState.players.length < 2) { setStartError('Need at least 2 players to start.'); return }
    setLoading(true)
    setStartError('')

    try {
      const shuffledPlayers = shuffle(roomState.players)
      const playerCount = shuffledPlayers.length

      if (customPoolText.trim()) {
        const refs = customPoolText.trim().split(/\s+/).filter(r => r.startsWith('ALT_'))
        if (!refs.length) { setStartError('No valid card references found in custom pool.'); setLoading(false); return }
        const packs = generatePacksFromPool(refs, playerCount, 4)
        const state = buildInitialState(
          { sets: [], playerCount, lang, customPool: true, includeHeroes },
          shuffledPlayers, packs
        )
        await supabase.from('draft_rooms').update({ state }).eq('id', code)
        return
      }

      const setsToUse = resolveConfig(playerCount)
      if (!setsToUse || !Object.keys(setsToUse).filter(k => setsToUse[k] > 0).length) {
        setStartError('Select a set to draft from.')
        setLoading(false)
        return
      }

      const setCodes = Object.keys(setsToUse).filter(k => setsToUse[k] > 0)
      const results = await Promise.all(setCodes.map(s => fetchSet(s, lang)))
      const allCards = results.flat()
      if (!allCards.length) { setStartError('No cards loaded. Check set selection.'); setLoading(false); return }

      const packs = generateAllPacks(allCards, playerCount, 4, { includeHeroes })
      const state = buildInitialState(
        { sets: setCodes, playerCount, lang, includeHeroes },
        shuffledPlayers, packs
      )
      await supabase.from('draft_rooms').update({ state }).eq('id', code)
    } catch (err) {
      setStartError('Error starting draft: ' + err.message)
      setLoading(false)
    }
  }, [roomState, configTab, selectedPreset, selectedSets, lang, customPoolText, code, includeHeroes])

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
                <input readOnly value={joinUrl}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-400 font-mono" />
                <button onClick={copyLink}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    linkCopied ? 'bg-green-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>
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
          <div className="bg-gray-900 rounded-xl overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b border-gray-800">
              {['presets', 'advanced'].map(t => (
                <button key={t} onClick={() => setConfigTab(t)}
                  className={`flex-1 py-3 text-sm font-medium transition-colors capitalize ${
                    configTab === t
                      ? 'text-amber-400 border-b-2 border-amber-400 bg-gray-900'
                      : 'text-gray-500 hover:text-gray-300 bg-gray-800/50'}`}>
                  {t}
                </button>
              ))}
            </div>

            <div className="p-6 space-y-5">
              {/* PRESETS TAB */}
              {configTab === 'presets' && (
                <div>
                  <p className="text-sm text-gray-400 mb-3">
                    Select a set — each player receives 4 packs of that set.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {SETS.map(set => {
                      const selected = selectedPreset === set.code
                      const assets = SET_ASSETS[set.code]
                      const logoUrl = assets?.logo
                      const iconUrl = assets?.icon
                      return (
                        <button
                          key={set.code}
                          onClick={() => setSelectedPreset(selected ? null : set.code)}
                          className={`relative flex flex-col items-center justify-center rounded-xl border-2 p-3 h-32 transition-all overflow-hidden gap-1 ${
                            selected
                              ? 'border-amber-500 shadow-lg shadow-amber-500/20'
                              : 'border-gray-700 hover:border-gray-500'}`}
                          style={{ backgroundColor: set.color + 'cc' }}
                        >
                          {logoUrl ? (
                            <img src={logoUrl} alt={set.name} className="h-14 w-full object-contain"
                              onError={e => {
                                e.currentTarget.style.display = 'none'
                                e.currentTarget.nextSibling?.style && (e.currentTarget.nextSibling.style.display = 'flex')
                              }} />
                          ) : iconUrl ? (
                            <img src={iconUrl} alt={set.name} className="h-10 object-contain"
                              onError={e => { e.currentTarget.style.display = 'none' }} />
                          ) : null}
                          <span className="text-xs text-gray-200 text-center leading-tight font-medium">{set.name}</span>
                          {selected && (
                            <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center text-xs text-gray-950 font-bold">✓</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ADVANCED TAB */}
              {configTab === 'advanced' && (
                <div className="space-y-5">
                  <SetSelector selectedSets={selectedSets} onChange={setSelectedSets} disabled={loading} />

                  <div>
                    <button onClick={() => setShowCustomPool(!showCustomPool)}
                      className="text-sm text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-1">
                      <span className="text-xs">{showCustomPool ? '▼' : '▶'}</span>
                      Custom card pool
                    </button>
                    {showCustomPool && (
                      <div className="mt-3">
                        <p className="text-xs text-gray-500 mb-2">
                          Paste card references (one per line, starting with ALT_). Overrides set selection.
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
                </div>
              )}

              {/* Shared settings */}
              <div className="pt-2 border-t border-gray-800 space-y-4">
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

                <div className="flex items-center gap-3">
                  <input type="checkbox" id="include-heroes" checked={includeHeroes}
                    onChange={e => setIncludeHeroes(e.target.checked)}
                    className="accent-amber-500 w-4 h-4" />
                  <label htmlFor="include-heroes" className="text-sm text-gray-300 cursor-pointer">
                    Include hero cards in packs
                  </label>
                </div>
              </div>

              {startError && <p className="text-red-400 text-sm">{startError}</p>}

              <button
                onClick={handleStart}
                disabled={loading || roomState.players.length < 2 || (configTab === 'presets' && !selectedPreset)}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-gray-950 font-bold rounded-lg transition-colors"
              >
                {loading ? 'Generating packs…' : 'Start draft'}
              </button>
            </div>
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
