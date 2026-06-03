import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { fetchSet, SETS, apiSetCode, fetchUniques, isUniqueRef } from '../lib/cardData.js'
import { SET_ASSETS } from '../lib/assets.js'
import { COMMUNITY_CUBES, setsForCube } from '../lib/cubes.js'
import CubePreviewModal from '../components/CubePreviewModal.jsx'
import { generateAllPacks, generatePacksFromPool, generateChaosPacks, generateCubeDraftPacks, generateCubeRecipePacks } from '../lib/packGenerator.js'
import { buildInitialState } from '../lib/draftLogic.js'
import SetSelector from '../components/SetSelector.jsx'
import ChaosSelector from '../components/ChaosSelector.jsx'

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
  const [draftMode, setDraftMode] = useState('draft') // 'draft' | 'sealed'
  const [configTab, setConfigTab] = useState('presets') // 'presets' | 'cubes' | 'advanced'
  const [selectedPreset, setSelectedPreset] = useState(null) // set code
  const [selectedCube, setSelectedCube] = useState(null) // cube id
  const [previewCube, setPreviewCube] = useState(null)  // cube being previewed
  const [selectedSets, setSelectedSets] = useState({ CORE: 1 })
  const [chaosMix, setChaosMix] = useState({}) // { setCode: boosterCount } for chaos draft
  const [lang, setLang] = useState('EN')
  const [includeHeroes, setIncludeHeroes] = useState(true)
  const [timerEnabled, setTimerEnabled] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(60)
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
        if (data.state.phase === 'drafting') navigate(`/room/${code}/draft`)
        else if (data.state.phase === 'sealed') navigate(`/room/${code}/sealed`)
        else if (data.state.phase === 'done') navigate(`/room/${code}/results`)
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
          else if (state.phase === 'sealed') navigate(`/room/${code}/sealed`)
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

  const handleStart = async () => {
    if (!roomState) return
    if (draftMode === 'draft' && roomState.players.length < 2) { setStartError('Need at least 2 players to start a draft.'); return }
    setLoading(true)
    setStartError('')

    try {
      const shuffledPlayers = shuffle(roomState.players)
      const playerCount = shuffledPlayers.length
      const SEALED_PACKS = 7

      // Sealed mode — each player gets a set of boosters (array of arrays)
      if (draftMode === 'sealed') {
        const SEALED_PACKS = 7

        // Cube sealed — curated pool; boosters drawn from the whole cube
        if (configTab === 'cubes' && selectedCube) {
          const cube = COMMUNITY_CUBES.find(c => c.id === selectedCube)
          if (!cube) { setStartError('Cube not found.'); setLoading(false); return }
          const rawCodes = [...new Set(setsForCube(cube.refs))]
          const results = await Promise.all(rawCodes.map(s => fetchSet(s, lang).catch(() => [])))
          const apiCodes = [...new Set(rawCodes.map(apiSetCode))]
          const sealedPacks = {}
          if (cube.booster) {
            // Recipe cube (e.g. LuigiNico's): SAME fixed booster as draft. Use the
            // multiset pool incl. uniques (which aren't in set data — fetch them).
            const byRef = new Map(results.flat().map(c => [c.reference, c]))
            const uniqueCards = await fetchUniques(cube.refs.filter(isUniqueRef), lang)
            for (const c of uniqueCards) byRef.set(c.reference, c)
            const allCards = cube.refs.map(r => byRef.get(r)).filter(Boolean)
            if (!allCards.length) { setStartError('Could not load cube card data.'); setLoading(false); return }
            for (let i = 0; i < playerCount; i++) {
              sealedPacks[String(i)] = generateCubeRecipePacks(allCards, SEALED_PACKS, cube.booster)
            }
          } else {
            const cubeRefSet = new Set(cube.refs)
            const allCards = results.flat().filter(c => cubeRefSet.has(c.reference))
            if (!allCards.length) { setStartError('Could not load cube card data.'); setLoading(false); return }
            for (let i = 0; i < playerCount; i++) {
              sealedPacks[String(i)] = generateAllPacks(allCards, 1, SEALED_PACKS, { includeHeroes })
            }
          }
          const state = {
            config: { sets: apiCodes, playerCount, lang, includeHeroes, cubeId: cube.id, mode: 'sealed' },
            players: shuffledPlayers, phase: 'sealed', sealedPacks, version: 0,
          }
          {
            const { error: upErr } = await supabase.from('draft_rooms').update({ state }).eq('id', code)
            if (upErr) { setStartError('Could not start: ' + upErr.message); setLoading(false); return }
          }
          return
        }

        // Presets / advanced — single-set boosters (a booster never mixes sets).
        // Preset = 7 boosters of the one set; advanced = per-set booster counts.
        const mix = configTab === 'presets' && selectedPreset
          ? { [selectedPreset]: SEALED_PACKS }
          : Object.fromEntries(Object.entries(selectedSets).filter(([, n]) => n > 0))
        const setCodes = Object.keys(mix)
        if (!setCodes.length) { setStartError('Select a set.'); setLoading(false); return }
        const fetched = await Promise.all(setCodes.map(async s => [s, await fetchSet(s, lang).catch(() => [])]))
        const cardsBySet = Object.fromEntries(fetched)
        if (!Object.values(cardsBySet).some(c => c.length)) { setStartError('No cards loaded.'); setLoading(false); return }
        const apiCodes = [...new Set(setCodes.map(apiSetCode))]
        const sealedPacks = {}
        for (let i = 0; i < playerCount; i++) {
          sealedPacks[String(i)] = generateChaosPacks(cardsBySet, mix, { includeHeroes })
        }
        const state = {
          config: { sets: apiCodes, playerCount, lang, includeHeroes, mode: 'sealed', packMix: mix },
          players: shuffledPlayers, phase: 'sealed', sealedPacks, version: 0,
        }
        {
          const { error: upErr } = await supabase.from('draft_rooms').update({ state }).eq('id', code)
          if (upErr) { setStartError('Could not start: ' + upErr.message); setLoading(false); return }
        }
        return
      }

      // Cube mode — fetch card data and apply booster rules
      if (configTab === 'cubes' && selectedCube) {
        const cube = COMMUNITY_CUBES.find(c => c.id === selectedCube)
        if (!cube) { setStartError('Cube not found.'); setLoading(false); return }
        if (cube.heroDraft && (playerCount < 2 || playerCount > 4)) {
          setStartError('This cube supports 2-4 players.'); setLoading(false); return
        }
        const setCodes = [...new Set(setsForCube(cube.refs))]
        const results = await Promise.all(setCodes.map(s => fetchSet(s, lang).catch(() => [])))
        const apiCodes = [...new Set(setCodes.map(apiSetCode))]
        let packs
        if (cube.heroDraft) {
          // Multi-copy cube: preserve duplicate refs (mapping each to its card object),
          // deal equal packs. Heroes are not in the packs (drafted manually).
          const byRef = new Map(results.flat().map(c => [c.reference, c]))
          // Uniques aren't in set data — fetch them from the Altered API and merge.
          const uniqueCards = await fetchUniques(cube.refs.filter(isUniqueRef), lang)
          for (const c of uniqueCards) byRef.set(c.reference, c)
          const allCards = cube.refs.map(r => byRef.get(r)).filter(Boolean)
          if (!allCards.length) { setStartError('Could not load cube card data.'); setLoading(false); return }
          packs = cube.booster
            ? generateCubeRecipePacks(allCards, playerCount * 4, cube.booster)
            : generateCubeDraftPacks(allCards, playerCount * 4)
        } else {
          const cubeRefSet = new Set(cube.refs)
          const allCards = results.flat().filter(c => cubeRefSet.has(c.reference))
          if (!allCards.length) { setStartError('Could not load cube card data.'); setLoading(false); return }
          packs = generateAllPacks(allCards, playerCount, 4, { includeHeroes, cubeMode: true })
        }
        const state = buildInitialState(
          // Cubes never use the pick timer.
          { sets: apiCodes, playerCount, lang, cubeId: cube.id, includeHeroes, timerEnabled: false },
          shuffledPlayers, packs
        )
        {
          const { error: upErr } = await supabase.from('draft_rooms').update({ state }).eq('id', code)
          if (upErr) { setStartError('Could not start: ' + upErr.message); setLoading(false); return }
        }
        return
      }

      // Custom pool mode — same booster rules
      if (customPoolText.trim()) {
        const refs = customPoolText.trim().split(/\s+/).filter(r => r.startsWith('ALT_'))
        if (!refs.length) { setStartError('No valid card references found in custom pool.'); setLoading(false); return }
        const rawCodes = [...new Set(refs.map(r => r.split('_')[1]).filter(Boolean))]
        const results = await Promise.all(rawCodes.map(s => fetchSet(s, lang).catch(() => [])))
        const refSet = new Set(refs)
        const allCards = results.flat().filter(c => refSet.has(c.reference))
        const packs = allCards.length
          ? generateAllPacks(allCards, playerCount, 4, { includeHeroes })
          : generatePacksFromPool(refs, playerCount, 4) // fallback if fetch fails
        const apiCodes = [...new Set(rawCodes.map(apiSetCode))]
        const state = buildInitialState(
          { sets: apiCodes, playerCount, lang, customPool: true, includeHeroes, timerEnabled, timerSeconds },
          shuffledPlayers, packs
        )
        {
          const { error: upErr } = await supabase.from('draft_rooms').update({ state }).eq('id', code)
          if (upErr) { setStartError('Could not start: ' + upErr.message); setLoading(false); return }
        }
        return
      }

      // Chaos draft — single-set boosters mixed in a bag and dealt at random
      if (configTab === 'chaos') {
        const mix = Object.fromEntries(Object.entries(chaosMix).filter(([, n]) => n > 0))
        const setCodes = Object.keys(mix)
        if (!setCodes.length) { setStartError('Add some boosters to the bag.'); setLoading(false); return }
        const totalBoosters = Object.values(mix).reduce((a, b) => a + b, 0)
        const target = playerCount * 4
        if (totalBoosters !== target) {
          setStartError(`Need exactly ${target} boosters (${playerCount} players × 4). You have ${totalBoosters}.`)
          setLoading(false); return
        }
        const fetched = await Promise.all(setCodes.map(async s => [s, await fetchSet(s, lang).catch(() => [])]))
        const cardsBySet = Object.fromEntries(fetched)
        if (!Object.values(cardsBySet).some(c => c.length)) { setStartError('No cards loaded. Check set selection.'); setLoading(false); return }
        const packs = generateChaosPacks(cardsBySet, mix, { includeHeroes })
        const apiCodes = [...new Set(setCodes.map(apiSetCode))]
        const state = buildInitialState(
          { sets: apiCodes, playerCount, lang, includeHeroes, timerEnabled, timerSeconds, chaosMix: mix },
          shuffledPlayers, packs
        )
        {
          const { error: upErr } = await supabase.from('draft_rooms').update({ state }).eq('id', code)
          if (upErr) { setStartError('Could not start: ' + upErr.message); setLoading(false); return }
        }
        return
      }

      // Booster preset / advanced mode
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
        { sets: setCodes, playerCount, lang, includeHeroes, timerEnabled, timerSeconds },
        shuffledPlayers, packs
      )
      const { error: upErr } = await supabase.from('draft_rooms').update({ state }).eq('id', code)
      if (upErr) { setStartError('Could not start: ' + upErr.message); setLoading(false); return }
    } catch (err) {
      setStartError('Error starting draft: ' + err.message)
      setLoading(false)
    }
  }

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
              <p className="text-4xl sm:text-5xl font-mono font-bold tracking-widest text-amber-400">{code}</p>
              <p className="text-sm text-gray-500 mt-2">Share this code or the link below</p>
              <div className="flex gap-2 mt-3">
                <input readOnly value={joinUrl}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-400 font-mono min-w-0" />
                <button onClick={copyLink}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                    linkCopied ? 'bg-green-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>
                  {linkCopied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <img src={qrUrl} alt="QR code" className="hidden sm:block w-[120px] h-[120px] rounded-lg shrink-0" />
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
            <p className="text-xs text-gray-500 mt-3">
              {isHost && draftMode === 'sealed'
                ? 'You can start sealed solo, or wait for others to join.'
                : 'Waiting for more players to join…'}
            </p>
          )}
        </div>

        {/* Draft config — host only */}
        {isHost && (
          <div className="bg-gray-900 rounded-xl overflow-hidden">
            {/* Mode selector: Draft vs Sealed */}
            <div className="grid grid-cols-2 border-b border-gray-800">
              {[{ id: 'draft', label: 'Draft', desc: 'Pick from passing packs' },
                { id: 'sealed', label: 'Sealed', desc: '7 boosters, build your pool' }].map(m => (
                <button key={m.id} onClick={() => { setDraftMode(m.id); if (m.id === 'sealed' && configTab === 'chaos') setConfigTab('presets') }}
                  className={`py-3 px-4 text-left transition-colors ${
                    draftMode === m.id ? 'bg-amber-500/10 border-b-2 border-amber-500' : 'hover:bg-gray-800/50'}`}>
                  <p className={`text-sm font-semibold ${draftMode === m.id ? 'text-amber-400' : 'text-gray-400'}`}>{m.label}</p>
                  <p className="text-xs text-gray-600 hidden sm:block">{m.desc}</p>
                </button>
              ))}
            </div>

            {/* Config tab bar */}
            <div className="flex border-b border-gray-800">
              {(draftMode === 'draft' ? ['presets', 'cubes', 'advanced', 'chaos'] : ['presets', 'cubes', 'advanced']).map(t => (
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {SETS.filter(s => !s.hidden).map(set => {
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
                              onError={e => { e.currentTarget.style.display = 'none' }} />
                          ) : iconUrl ? (
                            <img src={iconUrl} alt={set.name} className="h-10 object-contain"
                              onError={e => { e.currentTarget.style.display = 'none' }} />
                          ) : null}
                          <span className="text-xs text-gray-200 text-center leading-tight font-medium px-1">{set.name}</span>
                          {selected && (
                            <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center text-xs text-gray-950 font-bold">✓</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* CUBES TAB */}
              {configTab === 'cubes' && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-400">Community cubes — curated card pools ready to draft.</p>
                  {COMMUNITY_CUBES.map(cube => {
                    const selected = selectedCube === cube.id
                    return (
                      <div key={cube.id}
                        className={`rounded-xl border-2 transition-all ${
                          selected ? 'border-amber-500 bg-amber-500/5' : 'border-gray-700 bg-gray-800'}`}>
                        <button onClick={() => setSelectedCube(selected ? null : cube.id)}
                          className="w-full text-left p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-sm text-gray-100">{cube.name}</p>
                              <p className="text-xs text-gray-500 mt-0.5">by {cube.author} · {cube.cardCount} cards</p>
                              <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{cube.description}</p>
                            </div>
                            {selected && (
                              <span className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center text-xs text-gray-950 font-bold shrink-0">✓</span>
                            )}
                          </div>
                        </button>
                        <div className="px-4 pb-3">
                          <button onClick={() => setPreviewCube(cube)}
                            className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
                            Preview cube →
                          </button>
                        </div>
                      </div>
                    )
                  })}
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

              {/* CHAOS TAB */}
              {configTab === 'chaos' && (
                <ChaosSelector
                  mix={chaosMix}
                  onChange={setChaosMix}
                  target={roomState.players.length * 4}
                  disabled={loading}
                />
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

                {/* Pick timer — not offered for cubes */}
                {configTab !== 'cubes' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" id="timer-enabled" checked={timerEnabled}
                        onChange={e => setTimerEnabled(e.target.checked)}
                        className="accent-amber-500 w-4 h-4" />
                      <label htmlFor="timer-enabled" className="text-sm text-gray-300 cursor-pointer">
                        Pick timer
                      </label>
                    </div>
                    {timerEnabled && (
                      <div className="flex items-center gap-3 pl-7">
                        <span className="text-sm text-gray-400">Time per pick:</span>
                        <div className="flex gap-2">
                          {[30, 60, 90, 120].map(s => (
                            <button key={s} onClick={() => setTimerSeconds(s)}
                              className={`px-2.5 py-1 rounded text-sm transition-colors ${timerSeconds === s
                                ? 'bg-amber-500 text-gray-950 font-bold'
                                : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}>
                              {s}s
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {startError && <p className="text-red-400 text-sm">{startError}</p>}

              <button
                onClick={handleStart}
                disabled={loading
                || (draftMode === 'draft' && roomState.players.length < 2)
                || (configTab === 'presets' && draftMode === 'draft' && !selectedPreset)
                || (configTab === 'presets' && draftMode === 'sealed' && !selectedPreset)
                || (configTab === 'cubes' && !selectedCube)
                || (configTab === 'chaos' && Object.values(chaosMix).reduce((a, b) => a + (b || 0), 0) !== roomState.players.length * 4)}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-gray-950 font-bold rounded-lg transition-colors"
              >
                {loading ? 'Generating packs…' : draftMode === 'sealed' ? 'Start sealed' : 'Start draft'}
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

      {previewCube && (
        <CubePreviewModal cube={previewCube} onClose={() => setPreviewCube(null)} />
      )}
    </div>
  )
}
