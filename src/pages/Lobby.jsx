import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { fetchSet, SETS, apiSetCode, fetchUniques, isUniqueRef } from '../lib/cardData.js'
import { SET_ASSETS } from '../lib/assets.js'
import { COMMUNITY_CUBES, setsForCube } from '../lib/cubes.js'
import CubePreviewModal from '../components/CubePreviewModal.jsx'
import { generateAllPacks, generatePacksFromPool, generateChaosPacks, generateCubeRecipePacks, generateStructuredPacks, generateCubeDraftPacks, dealHeroSlots } from '../lib/packGenerator.js'
import { buildInitialState } from '../lib/draftLogic.js'
import { parseDecklist } from '../lib/cubeParser.js'
import { resolveCubeRefs } from '../lib/cubeResolve.js'
import { listDecks, getDeck, deckCardsToRefs } from '../lib/decks.js'
import { useAuth } from '../auth/AuthProvider.jsx'
import SetSelector from '../components/SetSelector.jsx'
import MultiSetSelector from '../components/MultiSetSelector.jsx'
import TopNav from '../components/TopNav.jsx'

const TAB_LABELS = { presets: 'Presets', cubes: 'Cubes', advanced: 'Advanced', multiset: 'Multi-Set' }

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
  const { user, login } = useAuth()

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
  // Pasted personal cube: parsed + resolved into { name, cards:[refs], heroes:[refs], unresolved:[refs] }.
  // Carried inline in room state as config.customCube (no cubeId, no storage).
  const [customCube, setCustomCube] = useState(null)
  const [customCubeText, setCustomCubeText] = useState('')
  const [customCubeName, setCustomCubeName] = useState('')
  const [parsingCube, setParsingCube] = useState(false)
  const [parseMsg, setParseMsg] = useState('')
  // Load-a-cube-from-Re:Union-decks (Cubes tab)
  const [myDecks, setMyDecks] = useState(null) // null = not loaded yet; [] = loaded, empty
  const [loadingDecks, setLoadingDecks] = useState(false)
  const [decksMsg, setDecksMsg] = useState('')
  const [deckSearch, setDeckSearch] = useState('')   // name filter for the deck picker
  const [deckFormat, setDeckFormat] = useState('all') // format filter ('all' | standard | sandbox | …)
  const [selectedDeckIds, setSelectedDeckIds] = useState([]) // decks ticked to merge into one cube
  const [selectedSets, setSelectedSets] = useState({ CORE: 1 })
  const [multiSetMix, setMultiSetMix] = useState({ CORE: 4 }) // per-player pack counts (sum = 4) for the Multi-Set draft tab
  const [equalPacks, setEqualPacks] = useState(true) // ON = same single-set boosters for all; OFF = random bag
  const [lang, setLang] = useState('EN')
  const [includeHeroes, setIncludeHeroes] = useState(true)
  // Free hero choice: heroes are kept OUT of packs/boosters and the player instead
  // picks any hero from the full roster when building their deck (Results/Sealed).
  const [freeHero, setFreeHero] = useState(false)
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
        if (data.state.phase === 'drafting' || data.state.phase === 'heroDraft') navigate(`/room/${code}/draft`)
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
          if (state.phase === 'drafting' || state.phase === 'heroDraft') navigate(`/room/${code}/draft`)
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

  // Parse a pasted decklist and resolve it against card data: split heroes out
  // (cardType HERO), flag refs that don't resolve, keep duplicate copies. Uniques
  // resolve from the bundled snapshot only.
  async function handleParseCube() {
    setParseMsg('')
    const { refs } = parseDecklist(customCubeText)
    if (!refs.length) {
      setParseMsg('No card references found. Paste lines like "1 ALT_CORE_B_YZ_03_C".')
      return
    }
    setParsingCube(true)
    try {
      // resolveCubeRefs canonicalizes alt-art/promo printings, fetches sets + uniques,
      // and splits heroes — shared with the load-from-Re:Union-decks flow below.
      const { cards, heroes, unresolved } = await resolveCubeRefs(refs, lang)
      if (!cards.length) {
        setParseMsg('No draftable (non-hero) cards resolved — check your references.')
        setParsingCube(false); return
      }
      setCustomCube({ name: customCubeName.trim() || 'Custom cube', cards, heroes, unresolved, source: 'paste' })
      setSelectedCube(null) // custom + built-in cubes are mutually exclusive
    } catch (e) {
      setParseMsg('Could not load card data: ' + e.message)
    }
    setParsingCube(false)
  }

  // Load the signed-in user's Re:Union decks (Cubes tab).
  async function handleLoadDecks() {
    setDecksMsg(''); setLoadingDecks(true)
    try {
      const decks = await listDecks()
      setMyDecks(decks)
      if (!decks.length) setDecksMsg('No decks found in your Re:Union account.')
    } catch (e) { setDecksMsg(e.message) }
    setLoadingDecks(false)
  }

  const deckKey = d => d.id ?? d.uuid ?? d.name
  function toggleDeck(id) {
    setSelectedDeckIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])
  }

  // Merge the chosen Re:Union deck(s) into ONE custom cube (same shape as a pasted
  // cube). Combining several decks stacks copies into a bigger multiset pool — useful
  // since a single ~40-card deck is too small to draft with a full table.
  async function handleLoadSelectedDecks() {
    const chosen = (myDecks ?? []).filter(d => selectedDeckIds.includes(deckKey(d)))
    if (!chosen.length) return
    setDecksMsg(''); setLoadingDecks(true)
    try {
      const lists = await Promise.all(chosen.map(d => getDeck(d.id ?? d.uuid).then(deckCardsToRefs)))
      const allRefs = lists.flat()
      if (!allRefs.length) { setDecksMsg('Those decks have no cards.'); setLoadingDecks(false); return }
      const { cards, heroes, unresolved } = await resolveCubeRefs(allRefs, lang)
      if (!cards.length) { setDecksMsg('No draftable cards resolved from those decks.'); setLoadingDecks(false); return }
      const name = chosen.length === 1
        ? (chosen[0].name || 'Re:Union deck')
        : `${chosen.length} decks (${chosen.map(d => d.name || 'Untitled').slice(0, 3).join(', ')}${chosen.length > 3 ? '…' : ''})`
      setCustomCube({ name, cards, heroes, unresolved, source: 'reunion' })
      setSelectedCube(null) // custom + built-in cubes are mutually exclusive
    } catch (e) { setDecksMsg(e.message) }
    setLoadingDecks(false)
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
      // When free-hero is on, no heroes go into packs/boosters (players free-pick later).
      const packHeroes = includeHeroes && !freeHero

      // Sealed mode — each player gets a set of boosters (array of arrays)
      if (draftMode === 'sealed') {
        const SEALED_PACKS = 7

        // Pasted personal cube — sealed. Heroes STAY in the pool (sealed has no draft
        // phase) unless free-hero is on, in which case they're picked at deckbuild time.
        if (configTab === 'cubes' && customCube) {
          const allRefs = [...customCube.cards, ...(freeHero ? [] : customCube.heroes)]
          const rawCodes = [...new Set(setsForCube(allRefs))]
          const results = await Promise.all(rawCodes.map(s => fetchSet(s, lang).catch(() => [])))
          const apiCodes = [...new Set(rawCodes.map(apiSetCode))]
          const byRef = new Map(results.flat().map(c => [c.reference, c]))
          const uniqueCards = await fetchUniques(allRefs.filter(isUniqueRef), lang)
          for (const c of uniqueCards) byRef.set(c.reference, c)
          const pool = allRefs.map(r => byRef.get(r)).filter(Boolean)
          if (pool.length < SEALED_PACKS) {
            setStartError(`This cube is too small for sealed (need at least ${SEALED_PACKS} cards).`); setLoading(false); return
          }
          const sealedPacks = {}
          for (let i = 0; i < playerCount; i++) sealedPacks[String(i)] = generateCubeDraftPacks(pool, SEALED_PACKS)
          const state = {
            config: { sets: apiCodes, playerCount, lang, freeHero, includeHeroes, mode: 'sealed', customCube: { name: customCube.name, cards: customCube.cards, heroes: customCube.heroes } },
            players: shuffledPlayers, phase: 'sealed', sealedPacks, version: 0,
          }
          const { error: upErr } = await supabase.from('draft_rooms').update({ state }).eq('id', code)
          if (upErr) { setStartError('Could not start: ' + upErr.message); setLoading(false); return }
          return
        }

        // Cube sealed — curated pool; boosters drawn from the whole cube
        if (configTab === 'cubes' && selectedCube) {
          const cube = COMMUNITY_CUBES.find(c => c.id === selectedCube)
          if (!cube) { setStartError('Cube not found.'); setLoading(false); return }
          // Include hero refs so their sets load (they fill each booster's slot 0 below).
          const rawCodes = [...new Set(setsForCube([...cube.refs, ...(cube.heroes ?? [])]))]
          const results = await Promise.all(rawCodes.map(s => fetchSet(s, lang).catch(() => [])))
          const apiCodes = [...new Set(rawCodes.map(apiSetCode))]
          const byRef = new Map(results.flat().map(c => [c.reference, c]))
          // Hero-draft cubes keep heroes in a separate pool (not in refs). Sealed has no
          // hero-draft phase, so deal one hero into each booster's first slot instead.
          const heroRefs = (cube.heroDraft && !freeHero) ? [...new Set(cube.heroes ?? [])].filter(r => byRef.has(r)) : []
          const sealedPacks = {}
          if (cube.booster) {
            // Recipe cube (e.g. LuigiNico's): SAME fixed booster as draft. Use the
            // multiset pool incl. uniques (which aren't in set data — fetch them).
            const uniqueCards = await fetchUniques(cube.refs.filter(isUniqueRef), lang)
            for (const c of uniqueCards) byRef.set(c.reference, c)
            const allCards = cube.refs.map(r => byRef.get(r)).filter(Boolean)
            if (!allCards.length) { setStartError('Could not load cube card data.'); setLoading(false); return }
            for (let i = 0; i < playerCount; i++) {
              sealedPacks[String(i)] = dealHeroSlots(generateCubeRecipePacks(allCards, SEALED_PACKS, cube.booster), heroRefs)
            }
          } else {
            const cubeRefSet = new Set(cube.refs)
            const allCards = results.flat().filter(c => cubeRefSet.has(c.reference))
            if (!allCards.length) { setStartError('Could not load cube card data.'); setLoading(false); return }
            for (let i = 0; i < playerCount; i++) {
              sealedPacks[String(i)] = dealHeroSlots(generateAllPacks(allCards, 1, SEALED_PACKS, { includeHeroes: packHeroes }), heroRefs)
            }
          }
          const state = {
            config: { sets: apiCodes, playerCount, lang, freeHero, includeHeroes, cubeId: cube.id, mode: 'sealed' },
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
          sealedPacks[String(i)] = generateChaosPacks(cardsBySet, mix, { includeHeroes: packHeroes })
        }
        const state = {
          config: { sets: apiCodes, playerCount, lang, freeHero, includeHeroes, mode: 'sealed', packMix: mix },
          players: shuffledPlayers, phase: 'sealed', sealedPacks, version: 0,
        }
        {
          const { error: upErr } = await supabase.from('draft_rooms').update({ state }).eq('id', code)
          if (upErr) { setStartError('Could not start: ' + upErr.message); setLoading(false); return }
        }
        return
      }

      // Pasted personal cube — draft. Keeps duplicate copies (multiset, equal packs).
      // Heroes are drafted in-app via the shared-pool snake when there are at least as
      // many as players; otherwise they fold into the card packs so none are lost.
      if (configTab === 'cubes' && customCube) {
        const allRefs = [...customCube.cards, ...customCube.heroes]
        const rawCodes = [...new Set(setsForCube(allRefs))]
        const results = await Promise.all(rawCodes.map(s => fetchSet(s, lang).catch(() => [])))
        const apiCodes = [...new Set(rawCodes.map(apiSetCode))]
        const byRef = new Map(results.flat().map(c => [c.reference, c]))
        const uniqueCards = await fetchUniques(allRefs.filter(isUniqueRef), lang)
        for (const c of uniqueCards) byRef.set(c.reference, c)

        const heroUnique = [...new Set(customCube.heroes)]
        // Free-hero: heroes leave the pool entirely (picked at deckbuild). Otherwise
        // snake-draft them when there are enough, else fold them into the card packs.
        const useHeroDraft = !freeHero && heroUnique.length >= playerCount
        const cardRefs = (useHeroDraft || freeHero) ? customCube.cards : [...customCube.cards, ...customCube.heroes]
        const cardPool = cardRefs.map(r => byRef.get(r)).filter(Boolean)
        const totalPacks = playerCount * 4
        if (cardPool.length < totalPacks) {
          setStartError(`This cube is too small for ${playerCount} players — needs at least ${totalPacks} non-hero cards (has ${cardPool.length}).`)
          setLoading(false); return
        }
        const packs = generateCubeDraftPacks(cardPool, totalPacks)
        const heroPool = useHeroDraft ? shuffle(heroUnique) : null
        const state = buildInitialState(
          { sets: apiCodes, playerCount, lang, freeHero, includeHeroes: false, timerEnabled, timerSeconds, customCube: { name: customCube.name, cards: customCube.cards, heroes: customCube.heroes } },
          shuffledPlayers, packs, heroPool
        )
        const { error: upErr } = await supabase.from('draft_rooms').update({ state }).eq('id', code)
        if (upErr) { setStartError('Could not start: ' + upErr.message); setLoading(false); return }
        return
      }

      // Cube mode — fetch card data and apply booster rules
      if (configTab === 'cubes' && selectedCube) {
        const cube = COMMUNITY_CUBES.find(c => c.id === selectedCube)
        if (!cube) { setStartError('Cube not found.'); setLoading(false); return }
        const maxPlayers = cube.maxPlayers ?? 4
        if (cube.heroDraft && (playerCount < 2 || playerCount > maxPlayers)) {
          setStartError(`This cube supports 2-${maxPlayers} players.`); setLoading(false); return
        }
        // Include the hero refs so their sets load too (heroes are drafted in-app).
        const setCodes = [...new Set(setsForCube([...cube.refs, ...(cube.heroes ?? [])]))]
        const results = await Promise.all(setCodes.map(s => fetchSet(s, lang).catch(() => [])))
        const apiCodes = [...new Set(setCodes.map(apiSetCode))]
        let packs
        if (cube.heroDraft) {
          // Multi-copy cube: preserve duplicate refs (mapping each to its card object),
          // deal equal packs. Heroes are not in these packs — they're drafted in-app
          // from the shared hero pool (see heroPool below).
          const byRef = new Map(results.flat().map(c => [c.reference, c]))
          // Uniques aren't in set data — fetch them from the Altered API and merge.
          const uniqueCards = await fetchUniques(cube.refs.filter(isUniqueRef), lang)
          for (const c of uniqueCards) byRef.set(c.reference, c)
          const allCards = cube.refs.map(r => byRef.get(r)).filter(Boolean)
          if (!allCards.length) { setStartError('Could not load cube card data.'); setLoading(false); return }
          packs = cube.booster
            ? generateCubeRecipePacks(allCards, playerCount * 4, cube.booster)
            : generateAllPacks(allCards, playerCount, 4, { includeHeroes: false, cubeMode: true })
        } else {
          const cubeRefSet = new Set(cube.refs)
          const allCards = results.flat().filter(c => cubeRefSet.has(c.reference))
          if (!allCards.length) { setStartError('Could not load cube card data.'); setLoading(false); return }
          packs = generateAllPacks(allCards, playerCount, 4, { includeHeroes: packHeroes, cubeMode: true })
        }
        // Hero-draft cubes draft heroes in-app from one shared pool (all the cube's
        // heroes), snake-drafted one-per-player after each card round until each has
        // min(3, …) heroes. Pass the shuffled hero pool; buildInitialState does the rest.
        const heroPool = (!freeHero && cube.heroDraft && cube.heroes?.length) ? shuffle(cube.heroes) : null
        const state = buildInitialState(
          { sets: apiCodes, playerCount, lang, freeHero, cubeId: cube.id, includeHeroes, timerEnabled, timerSeconds },
          shuffledPlayers, packs, heroPool
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
          ? generateAllPacks(allCards, playerCount, 4, { includeHeroes: packHeroes })
          : generatePacksFromPool(refs, playerCount, 4) // fallback if fetch fails
        const apiCodes = [...new Set(rawCodes.map(apiSetCode))]
        const state = buildInitialState(
          { sets: apiCodes, playerCount, lang, freeHero, customPool: true, includeHeroes, timerEnabled, timerSeconds },
          shuffledPlayers, packs
        )
        {
          const { error: upErr } = await supabase.from('draft_rooms').update({ state }).eq('id', code)
          if (upErr) { setStartError('Could not start: ' + upErr.message); setLoading(false); return }
        }
        return
      }

      // Multi-Set draft — single-set boosters. The "same packs" toggle picks the
      // distribution: ON  = per-player counts (sum 4); every player drafts the same
      // single-set boosters (one set per round). OFF = the WHOLE bag (sum players × 4),
      // shuffled and dealt at random.
      if (configTab === 'multiset') {
        const mix = Object.fromEntries(Object.entries(multiSetMix).filter(([, n]) => n > 0))
        const setCodes = Object.keys(mix)
        if (!setCodes.length) { setStartError('Select at least one set.'); setLoading(false); return }
        const total = Object.values(mix).reduce((a, b) => a + b, 0)
        const target = equalPacks ? 4 : playerCount * 4
        if (total !== target) {
          setStartError(equalPacks
            ? `Each player drafts exactly 4 packs — you have ${total}.`
            : `The bag needs exactly ${target} boosters (${playerCount} players × 4) — you have ${total}.`)
          setLoading(false); return
        }
        const fetched = await Promise.all(setCodes.map(async s => [s, await fetchSet(s, lang).catch(() => [])]))
        const cardsBySet = Object.fromEntries(fetched)
        if (!Object.values(cardsBySet).some(c => c.length)) { setStartError('No cards loaded. Check set selection.'); setLoading(false); return }
        const packs = equalPacks
          ? generateStructuredPacks(cardsBySet, mix, playerCount, { includeHeroes: packHeroes })
          : generateChaosPacks(cardsBySet, mix, { includeHeroes: packHeroes })
        const apiCodes = [...new Set(setCodes.map(apiSetCode))]
        const state = buildInitialState(
          { sets: apiCodes, playerCount, lang, freeHero, includeHeroes, timerEnabled, timerSeconds, multiSetMix: mix, equalPacks },
          shuffledPlayers, packs
        )
        {
          const { error: upErr } = await supabase.from('draft_rooms').update({ state }).eq('id', code)
          if (upErr) { setStartError('Could not start: ' + upErr.message); setLoading(false); return }
        }
        return
      }

      // Preset draft — 4 packs of the one selected set per player
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

      const packs = generateAllPacks(allCards, playerCount, 4, { includeHeroes: packHeroes })
      const state = buildInitialState(
        { sets: setCodes, playerCount, lang, freeHero, includeHeroes, timerEnabled, timerSeconds },
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
    return <div className="min-h-screen flex items-center justify-center text-muted">Loading room…</div>
  }

  const isHost = me.isHost

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <div className="flex-1 w-full flex flex-col items-center px-4 py-8">
      <div className="max-w-2xl w-full space-y-6">

        {/* Room code + share */}
        <div className="bg-surface rounded-xl p-6">
          <div className="flex gap-6 items-center">
            <div className="flex-1">
              <p className="text-xs text-faint uppercase tracking-widest mb-1">Room code</p>
              <p className="text-4xl sm:text-5xl font-mono font-bold tracking-widest text-accent">{code}</p>
              <p className="text-sm text-faint mt-2">Share this code or the link below</p>
              <div className="flex gap-2 mt-3">
                <input readOnly value={joinUrl}
                  className="flex-1 bg-surface2 border border-line rounded-lg px-3 py-1.5 text-xs text-muted font-mono min-w-0" />
                <button onClick={copyLink}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                    linkCopied ? 'bg-green-600 text-white' : 'bg-surface3 hover:bg-surface3 text-ink2'}`}>
                  {linkCopied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <img src={qrUrl} alt="QR code" className="hidden sm:block w-[120px] h-[120px] rounded-lg shrink-0" />
          </div>
        </div>

        {/* Players list */}
        <div className="bg-surface rounded-xl p-6">
          <h2 className="font-semibold mb-3 text-ink2">Players ({roomState.players.length})</h2>
          <ul className="space-y-2">
            {roomState.players.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 text-sm">
                <span className="w-7 h-7 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold">
                  {i + 1}
                </span>
                <span className="font-medium">{p.name}</span>
                {i === 0 && <span className="text-xs text-accent ml-auto">Host</span>}
                {p.id === me.id && <span className="text-xs text-faint ml-1">(you)</span>}
              </li>
            ))}
          </ul>
          {roomState.players.length < 2 && (
            <p className="text-xs text-faint mt-3">
              {isHost && draftMode === 'sealed'
                ? 'You can start sealed solo, or wait for others to join.'
                : 'Waiting for more players to join…'}
            </p>
          )}
        </div>

        {/* Draft config — host only */}
        {isHost && (
          <div className="bg-surface rounded-xl overflow-hidden">
            {/* Mode selector: Draft vs Sealed */}
            <div className="grid grid-cols-2 border-b border-line">
              {[{ id: 'draft', label: 'Draft', desc: 'Pick from passing packs' },
                { id: 'sealed', label: 'Sealed', desc: '7 boosters, build your pool' }].map(m => (
                <button key={m.id} onClick={() => {
                    setDraftMode(m.id)
                    // The Multi-Set tab is draft-only; sealed keeps the classic Advanced tab.
                    if (m.id === 'sealed' && configTab === 'multiset') setConfigTab('advanced')
                    if (m.id === 'draft' && configTab === 'advanced') setConfigTab('multiset')
                  }}
                  className={`py-3 px-4 text-left transition-colors ${
                    draftMode === m.id ? 'bg-accent/10 border-b-2 border-accent' : 'hover:bg-surface2/50'}`}>
                  <p className={`text-sm font-semibold ${draftMode === m.id ? 'text-accent' : 'text-muted'}`}>{m.label}</p>
                  <p className="text-xs text-faint hidden sm:block">{m.desc}</p>
                </button>
              ))}
            </div>

            {/* Config tab bar */}
            <div className="flex border-b border-line">
              {(draftMode === 'draft' ? ['presets', 'cubes', 'multiset'] : ['presets', 'cubes', 'advanced']).map(t => (
                <button key={t} onClick={() => setConfigTab(t)}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    configTab === t
                      ? 'text-accent border-b-2 border-accent2 bg-surface'
                      : 'text-faint hover:text-ink2 bg-surface2/50'}`}>
                  {TAB_LABELS[t] ?? t}
                </button>
              ))}
            </div>

            <div className="p-6 space-y-5">
              {/* PRESETS TAB */}
              {configTab === 'presets' && (
                <div>
                  <p className="text-sm text-muted mb-3">
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
                              ? 'border-accent shadow-lg shadow-accent/20'
                              : 'border-line hover:border-line'}`}
                          style={{ backgroundColor: set.color + 'cc' }}
                        >
                          {logoUrl ? (
                            <img src={logoUrl} alt={set.name} className="h-14 w-full object-contain"
                              onError={e => { e.currentTarget.style.display = 'none' }} />
                          ) : iconUrl ? (
                            <img src={iconUrl} alt={set.name} className="h-10 object-contain"
                              onError={e => { e.currentTarget.style.display = 'none' }} />
                          ) : null}
                          <span className="text-xs text-ink text-center leading-tight font-medium px-1">{set.name}</span>
                          {selected && (
                            <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent flex items-center justify-center text-xs text-on-accent font-bold">✓</span>
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
                  <p className="text-sm text-muted">Community cubes — curated card pools ready to draft.</p>
                  {COMMUNITY_CUBES.map(cube => {
                    const selected = selectedCube === cube.id
                    return (
                      <div key={cube.id}
                        className={`rounded-xl border-2 transition-all ${
                          selected ? 'border-accent bg-accent/5' : 'border-line bg-surface2'}`}>
                        <button onClick={() => { setSelectedCube(selected ? null : cube.id); setCustomCube(null) }}
                          className="w-full text-left p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-sm text-ink">{cube.name}</p>
                              <p className="text-xs text-faint mt-0.5">by {cube.author} · {cube.cardCount} cards</p>
                              <p className="text-xs text-muted mt-1.5 leading-relaxed">{cube.description}</p>
                            </div>
                            {selected && (
                              <span className="w-5 h-5 rounded-full bg-accent flex items-center justify-center text-xs text-on-accent font-bold shrink-0">✓</span>
                            )}
                          </div>
                        </button>
                        <div className="px-4 pb-3">
                          <button onClick={() => setPreviewCube(cube)}
                            className="text-xs text-accent hover:text-accent2 transition-colors">
                            Preview cube →
                          </button>
                        </div>
                      </div>
                    )
                  })}

                  {/* Load from your Re:Union decks */}
                  <div className={`rounded-xl border-2 p-4 space-y-3 transition-all ${
                    customCube?.source === 'reunion' ? 'border-accent bg-accent/5' : 'border-dashed border-line bg-surface2/40'}`}>
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm text-ink">⬇ Load from your Re:Union decks</p>
                      {customCube?.source === 'reunion' && (
                        <span className="w-5 h-5 rounded-full bg-accent flex items-center justify-center text-xs text-on-accent font-bold shrink-0">✓</span>
                      )}
                    </div>
                    {!user ? (
                      <div className="space-y-2">
                        <p className="text-xs text-faint leading-relaxed">Connect your Re:Union account to pick one of your decks and draft or seal with it as a cube.</p>
                        <button onClick={() => login()}
                          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-surface3 hover:bg-surface3 text-ink transition-colors">
                          Connect Re:Union
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <button onClick={handleLoadDecks} disabled={loadingDecks}
                            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-surface3 hover:bg-surface3 disabled:opacity-40 text-ink transition-colors">
                            {loadingDecks ? 'Loading…' : myDecks ? 'Refresh decks' : 'Load my decks'}
                          </button>
                          <span className="text-xs text-faint">as {user.pseudo}</span>
                        </div>
                        {myDecks && myDecks.length > 0 && (() => {
                          // Filter client-side by name + format. The list API has no card
                          // count, so a deck-size filter isn't possible here — name/format
                          // (the user's stated fallback) is what the API exposes.
                          const formats = [...new Set(myDecks.map(d => d.format).filter(Boolean))]
                          const q = deckSearch.trim().toLowerCase()
                          const shown = myDecks.filter(d =>
                            (deckFormat === 'all' || d.format === deckFormat) &&
                            (!q || (d.name ?? '').toLowerCase().includes(q)))
                          return (
                            <div className="space-y-2">
                              <input value={deckSearch} onChange={e => setDeckSearch(e.target.value)}
                                placeholder={`Search ${myDecks.length} deck${myDecks.length !== 1 ? 's' : ''} by name…`}
                                className="w-full bg-surface2 border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent" />
                              {formats.length > 1 && (
                                <div className="flex flex-wrap gap-1">
                                  {['all', ...formats].map(f => (
                                    <button key={f} onClick={() => setDeckFormat(f)}
                                      className={`px-2 py-0.5 rounded text-xs capitalize transition-colors ${
                                        deckFormat === f ? 'bg-accent text-on-accent font-bold' : 'bg-surface2 text-muted hover:text-ink'}`}>
                                      {f === 'all' ? 'All' : f.replace('_', ' ')}
                                    </button>
                                  ))}
                                </div>
                              )}
                              <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                                {shown.map((d, i) => {
                                  const checked = selectedDeckIds.includes(deckKey(d))
                                  return (
                                    <button key={deckKey(d) ?? i} onClick={() => toggleDeck(deckKey(d))}
                                      className={`w-full flex items-center gap-2 text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                        checked ? 'bg-accent/20 text-accent2' : 'bg-surface2 hover:bg-surface3 text-ink'}`}>
                                      <span className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center text-[10px] ${
                                        checked ? 'bg-accent border-accent text-on-accent' : 'border-line'}`}>{checked ? '✓' : ''}</span>
                                      <span className="truncate flex-1">{d.name || 'Untitled deck'}</span>
                                      {d.format && <span className="text-[10px] uppercase tracking-wide text-faint shrink-0">{d.format.replace('_', ' ')}</span>}
                                    </button>
                                  )
                                })}
                                {!shown.length && <p className="text-xs text-faint px-1 py-2">No decks match this filter.</p>}
                              </div>
                              <div className="flex items-center gap-3">
                                <button onClick={handleLoadSelectedDecks} disabled={loadingDecks || !selectedDeckIds.length}
                                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-accent hover:bg-accent2 disabled:opacity-40 text-on-accent transition-colors">
                                  {loadingDecks ? 'Loading…' : `Load ${selectedDeckIds.length || ''} deck${selectedDeckIds.length === 1 ? '' : 's'} as cube`.replace('  ', ' ')}
                                </button>
                                {selectedDeckIds.length > 0 && (
                                  <button onClick={() => setSelectedDeckIds([])} className="text-xs text-faint hover:text-ink2 transition-colors">Clear selection</button>
                                )}
                              </div>
                              <p className="text-[11px] text-faint">Tick one or more decks — multiple decks merge into a single, bigger cube.</p>
                            </div>
                          )
                        })()}
                        {customCube?.source === 'reunion' && (
                          <div className="text-xs space-y-1.5">
                            <p className="text-green-400">
                              ✓ Loaded “{customCube.name}” — {customCube.cards.length} card{customCube.cards.length !== 1 ? 's' : ''}
                              {customCube.heroes.length > 0 && ` · ${customCube.heroes.length} hero${customCube.heroes.length !== 1 ? 'es' : ''}`}
                              {customCube.unresolved.length > 0 && ` (${customCube.unresolved.length} unresolved, skipped)`}.
                            </p>
                            <div className="flex items-center gap-3">
                              <button onClick={() => setPreviewCube({ name: customCube.name, author: 'Re:Union', cardCount: customCube.cards.length + customCube.heroes.length, refs: [...customCube.cards, ...customCube.heroes] })}
                                className="text-accent hover:text-accent2 transition-colors">Preview cube →</button>
                              <button onClick={() => setCustomCube(null)} className="text-faint hover:text-ink2 transition-colors">Clear</button>
                            </div>
                          </div>
                        )}
                        {decksMsg && <p className="text-xs text-accent">{decksMsg}</p>}
                      </div>
                    )}
                  </div>

                  {/* Paste your own cube */}
                  <div className={`rounded-xl border-2 p-4 space-y-3 transition-all ${
                    customCube?.source === 'paste' ? 'border-accent bg-accent/5' : 'border-dashed border-line bg-surface2/40'}`}>
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm text-ink">＋ Paste your own cube</p>
                      {customCube?.source === 'paste' && (
                        <span className="w-5 h-5 rounded-full bg-accent flex items-center justify-center text-xs text-on-accent font-bold shrink-0">✓</span>
                      )}
                    </div>
                    <p className="text-xs text-faint leading-relaxed">
                      One card per line as <span className="font-mono text-muted">qty REF</span> (e.g.{' '}
                      <span className="font-mono text-muted">3 ALT_CORE_B_MU_06_R2</span>) — the same format as Export.
                      Heroes in the list are detected automatically and snake-drafted in-app. Nothing is saved; keep your own list.
                    </p>
                    <input value={customCubeName} onChange={e => setCustomCubeName(e.target.value)}
                      placeholder="Cube name (optional)"
                      className="w-full bg-surface2 border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent" />
                    <textarea value={customCubeText} onChange={e => setCustomCubeText(e.target.value)} rows={6}
                      placeholder={"1 ALT_CORE_B_YZ_03_C\n3 ALT_CORE_B_MU_06_R2\n..."}
                      className="w-full bg-surface2 border border-line rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-accent resize-none" />
                    <div className="flex items-center gap-3">
                      <button onClick={handleParseCube} disabled={parsingCube || !customCubeText.trim()}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium bg-surface3 hover:bg-surface3 disabled:opacity-40 text-ink transition-colors">
                        {parsingCube ? 'Parsing…' : customCube?.source === 'paste' ? 'Re-parse' : 'Parse & preview'}
                      </button>
                      {customCube?.source === 'paste' && (
                        <>
                          <button onClick={() => setPreviewCube({ name: customCube.name, author: 'You', cardCount: customCube.cards.length + customCube.heroes.length, refs: [...customCube.cards, ...customCube.heroes] })}
                            className="text-xs text-accent hover:text-accent2 transition-colors">
                            Preview →
                          </button>
                          <button onClick={() => { setCustomCube(null); setParseMsg('') }}
                            className="text-xs text-faint hover:text-ink2 transition-colors ml-auto">
                            Clear
                          </button>
                        </>
                      )}
                    </div>
                    {parseMsg && <p className="text-xs text-red-400">{parseMsg}</p>}
                    {customCube?.source === 'paste' && (
                      <div className="text-xs space-y-1">
                        <p className="text-green-400">
                          ✓ {customCube.cards.length} card{customCube.cards.length !== 1 ? 's' : ''}
                          {customCube.heroes.length > 0 && ` · ${customCube.heroes.length} hero${customCube.heroes.length !== 1 ? 'es' : ''}`} loaded
                          {customCube.heroes.length > 0 && (
                            new Set(customCube.heroes).size >= roomState.players.length
                              ? ' (heroes drafted in-app)'
                              : ' (too few heroes to draft in-app → dealt in packs)'
                          )}.
                        </p>
                        {customCube.unresolved.length > 0 && (
                          <p className="text-accent">
                            ⚠ {customCube.unresolved.length} reference{customCube.unresolved.length !== 1 ? 's' : ''} couldn't be resolved and {customCube.unresolved.length !== 1 ? 'were' : 'was'} skipped:{' '}
                            <span className="font-mono break-all text-accent2">
                              {customCube.unresolved.slice(0, 8).join(', ')}{customCube.unresolved.length > 8 ? ` … (+${customCube.unresolved.length - 8})` : ''}
                            </span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ADVANCED TAB */}
              {configTab === 'advanced' && (
                <div className="space-y-5">
                  <SetSelector selectedSets={selectedSets} onChange={setSelectedSets} disabled={loading} />

                  <div>
                    <button onClick={() => setShowCustomPool(!showCustomPool)}
                      className="text-sm text-muted hover:text-ink transition-colors flex items-center gap-1">
                      <span className="text-xs">{showCustomPool ? '▼' : '▶'}</span>
                      Custom card pool
                    </button>
                    {showCustomPool && (
                      <div className="mt-3">
                        <p className="text-xs text-faint mb-2">
                          Paste card references (one per line, starting with ALT_). Overrides set selection.
                        </p>
                        <textarea
                          value={customPoolText}
                          onChange={e => setCustomPoolText(e.target.value)}
                          rows={6}
                          placeholder={"ALT_CORE_B_AX_02_C\nALT_CORE_B_BR_03_R1\n..."}
                          className="w-full bg-surface2 border border-line rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-accent resize-none"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* MULTI-SET TAB (draft only) */}
              {configTab === 'multiset' && (
                <div className="space-y-5">
                  <MultiSetSelector
                    mix={multiSetMix}
                    onChange={setMultiSetMix}
                    equalPacks={equalPacks}
                    onEqualChange={setEqualPacks}
                    target={equalPacks ? 4 : roomState.players.length * 4}
                    disabled={loading}
                  />

                  <div>
                    <button onClick={() => setShowCustomPool(!showCustomPool)}
                      className="text-sm text-muted hover:text-ink transition-colors flex items-center gap-1">
                      <span className="text-xs">{showCustomPool ? '▼' : '▶'}</span>
                      Custom card pool
                    </button>
                    {showCustomPool && (
                      <div className="mt-3">
                        <p className="text-xs text-faint mb-2">
                          Paste card references (one per line, starting with ALT_). Overrides set selection.
                        </p>
                        <textarea
                          value={customPoolText}
                          onChange={e => setCustomPoolText(e.target.value)}
                          rows={6}
                          placeholder={"ALT_CORE_B_AX_02_C\nALT_CORE_B_BR_03_R1\n..."}
                          className="w-full bg-surface2 border border-line rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-accent resize-none"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Shared settings */}
              <div className="pt-2 border-t border-line space-y-4">
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

                <div className="flex items-center gap-3">
                  <input type="checkbox" id="include-heroes" checked={includeHeroes && !freeHero} disabled={freeHero}
                    onChange={e => setIncludeHeroes(e.target.checked)}
                    className="accent-accent w-4 h-4 disabled:opacity-40" />
                  <label htmlFor="include-heroes" className={`text-sm cursor-pointer ${freeHero ? 'text-faint' : 'text-ink2'}`}>
                    Include hero cards in packs
                  </label>
                </div>

                <div className="flex items-start gap-3">
                  <input type="checkbox" id="free-hero" checked={freeHero}
                    onChange={e => setFreeHero(e.target.checked)}
                    className="accent-accent w-4 h-4 mt-0.5" />
                  <label htmlFor="free-hero" className="text-sm text-ink2 cursor-pointer">
                    Free hero choice
                    <span className="block text-xs text-faint">All heroes available when building your deck — heroes won't appear in packs/boosters.</span>
                  </label>
                </div>

                {/* Pick timer — draft only (sealed has no pick passing) */}
                {draftMode === 'draft' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" id="timer-enabled" checked={timerEnabled}
                        onChange={e => setTimerEnabled(e.target.checked)}
                        className="accent-accent w-4 h-4" />
                      <label htmlFor="timer-enabled" className="text-sm text-ink2 cursor-pointer">
                        Pick timer
                      </label>
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
              </div>

              {startError && <p className="text-red-400 text-sm">{startError}</p>}

              <button
                onClick={handleStart}
                disabled={loading
                || (draftMode === 'draft' && roomState.players.length < 2)
                || (configTab === 'presets' && draftMode === 'draft' && !selectedPreset)
                || (configTab === 'presets' && draftMode === 'sealed' && !selectedPreset)
                || (configTab === 'cubes' && !selectedCube && !customCube)
                || (configTab === 'multiset' && Object.values(multiSetMix).reduce((a, b) => a + (b || 0), 0) !== (equalPacks ? 4 : roomState.players.length * 4))}
                className="w-full py-3 bg-accent hover:bg-accent2 disabled:opacity-40 text-on-accent font-bold rounded-lg transition-colors"
              >
                {loading ? 'Generating packs…' : draftMode === 'sealed' ? 'Start sealed' : 'Start draft'}
              </button>
            </div>
          </div>
        )}

        {!isHost && (
          <div className="bg-surface rounded-xl p-6 text-center text-muted text-sm">
            Waiting for the host to start the draft…
          </div>
        )}
      </div>
      </div>

      {previewCube && (
        <CubePreviewModal cube={previewCube} onClose={() => setPreviewCube(null)} />
      )}
    </div>
  )
}
