import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { fetchSet, apiSetCode, fetchUniques, isUniqueRef } from '../lib/cardData.js'
import { applyPick, applyHeroPick } from '../lib/draftLogic.js'
import CardGrid from '../components/CardGrid.jsx'
import DraftSidebar from '../components/DraftSidebar.jsx'
import PlayerStatus from '../components/PlayerStatus.jsx'
import CardPreview from '../components/CardPreview.jsx'
import PickTimer from '../components/PickTimer.jsx'
import MobileTabBar from '../components/MobileTabBar.jsx'
import DraftStats from '../components/DraftStats.jsx'
import { COMMUNITY_CUBES } from '../lib/cubes.js'

// Compact read-only strip of the heroes you've drafted (during the hero phase, and
// as a reminder afterward). `label` lets callers relabel it per phase.
function MyHeroes({ heroes, cardMap, label = 'Your heroes' }) {
  if (!heroes?.length) return null
  return (
    <div className="mb-4 border border-amber-500/30 bg-amber-500/5 rounded-lg px-3 py-2">
      <p className="text-xs font-semibold text-amber-400 mb-2">{label} ({heroes.length})</p>
      <div className="flex flex-wrap gap-2">
        {heroes.map((ref, i) => {
          const card = cardMap?.[ref]
          return (
            <div key={`${ref}-${i}`} className="w-12 rounded overflow-hidden border border-gray-700 bg-gray-800 shrink-0"
              title={card?.name ?? ref}>
              {card?.imagePath ? (
                <img src={card.imagePath} alt={card?.name ?? ''} loading="lazy"
                  className="w-full aspect-[2/3] object-cover"
                  onError={e => { e.currentTarget.style.display = 'none' }} />
              ) : (
                <div className="aspect-[2/3] flex items-center justify-center p-0.5 text-[8px] text-gray-500 text-center leading-tight">
                  {card?.name ?? ref}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Draft() {
  const { code } = useParams()
  const navigate = useNavigate()

  const [roomState, setRoomState] = useState(null)
  const [me, setMe] = useState(null)
  const [cardMap, setCardMap] = useState({})
  const [hoverCard, setHoverCard] = useState(null)
  const [picking, setPicking] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)
  const [fetchErrors, setFetchErrors] = useState([])
  const [mobileTab, setMobileTab] = useState('pack')

  // Reconnection
  const [needsRejoin, setNeedsRejoin] = useState(false)
  const [rejoinName, setRejoinName] = useState('')
  const [rejoinError, setRejoinError] = useState('')

  const stateRef = useRef(null)
  stateRef.current = roomState
  const pickingRef = useRef(false)
  pickingRef.current = picking
  // Hard lock against overlapping doPick invocations (timer + click, or retries).
  // Independent of the `picking` UI flag, which realtime clears on every update.
  const inFlightRef = useRef(false)

  useEffect(() => {
    const stored = localStorage.getItem(`player_${code}`)
    if (stored) setMe(JSON.parse(stored))
    else setNeedsRejoin(true)
  }, [code])

  useEffect(() => {
    if (needsRejoin && !me) return
    supabase.from('draft_rooms').select('state').eq('id', code).single()
      .then(async ({ data, error }) => {
        if (error || !data) { navigate('/'); return }
        const state = data.state
        setRoomState(state)
        if (state.phase === 'done') { navigate(`/room/${code}/results`); return }
        if (state.phase === 'sealed') { navigate(`/room/${code}/sealed`); return }

        if (state.config.sets?.length) {
          const errors = [], maps = {}
          const apiCodes = [...new Set(state.config.sets.map(apiSetCode))]
          await Promise.all(apiCodes.map(async s => {
            try {
              const cards = await fetchSet(s, state.config.lang || 'EN')
              for (const c of cards) maps[c.reference] = c
            } catch (e) { errors.push(`${s}: ${e.message}`) }
          }))
          if (errors.length) setFetchErrors(errors)
          // Cube uniques aren't in set data — pull them from the Altered API.
          const cube = COMMUNITY_CUBES.find(c => c.id === state.config.cubeId)
          if (cube?.refs) {
            const uCards = await fetchUniques(cube.refs.filter(isUniqueRef), state.config.lang || 'EN')
            for (const c of uCards) maps[c.reference] = c
          }
          setCardMap(maps)
        }
      })
  }, [code, navigate, me, needsRejoin])

  useEffect(() => {
    const channel = supabase
      .channel(`draft-${code}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'draft_rooms', filter: `id=eq.${code}` },
        payload => {
          const state = payload.new.state
          setRoomState(state)
          setPicking(false)
          if (state.phase === 'done') navigate(`/room/${code}/results`)
          if (state.phase === 'sealed') navigate(`/room/${code}/sealed`)
        })
      .on('system', {}, ev => {
        if (ev.event === 'CHANNEL_ERROR' || ev.event === 'CLOSED') setReconnecting(true)
        if (ev.event === 'SUBSCRIBED') setReconnecting(false)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [code, navigate])

  const isHeroPhase = roomState?.phase === 'heroDraft'
  const myIndex = roomState && me ? roomState.players.findIndex(p => p.id === me.id) : -1
  // Card draft: simultaneous — each seat has its own pack and is in waitingFor.
  // Hero draft (between rounds): turn-based — ONE shared pool of all heroes, picked in
  // snake order, so only the seat at heroOrder[heroTurnPos] can pick.
  const heroTurnIdx = isHeroPhase ? (roomState.heroOrder?.[roomState.heroTurnPos] ?? -1) : -1
  const isMyTurn = isHeroPhase
    ? (myIndex !== -1 && myIndex === heroTurnIdx)
    : (myIndex !== -1 && (roomState?.waitingFor?.includes(myIndex) ?? false))
  const myCardPack = (myIndex !== -1 && roomState) ? (roomState.packs[String(myIndex)] ?? []) : []
  const myPicks = (myIndex !== -1 && roomState) ? (roomState.picks[String(myIndex)] ?? []) : []
  const myHeroPicks = (myIndex !== -1 && roomState) ? (roomState.heroPicks?.[String(myIndex)] ?? []) : []
  const myPack = isHeroPhase ? (roomState?.heroPool ?? []) : myCardPack

  const doPick = useCallback(async (ref) => {
    if (inFlightRef.current) return
    let state = stateRef.current
    if (!state || !me) return
    // Whether this seat may pick `ref` right now — differs by phase. Card draft: it's
    // in your waitingFor and the card is in your pack. Hero draft: it's your turn in
    // the snake order and the hero is in the shared pool.
    const canPick = (s, idx) => s.phase === 'heroDraft'
      ? (s.heroOrder?.[s.heroTurnPos] === idx && (s.heroPool ?? []).includes(ref))
      : ((s.waitingFor?.includes(idx) ?? false) && (s.packs[String(idx)] ?? []).includes(ref))
    const idx0 = state.players.findIndex(p => p.id === me.id)
    if (idx0 === -1 || !canPick(state, idx0)) return

    inFlightRef.current = true
    setPicking(true)
    try {
      // Optimistic concurrency: only commit if the row is still at the version we read.
      // Concurrent picks (card draft) or a moved turn (hero draft) → re-sync and retry.
      for (let attempt = 0; attempt < 12; attempt++) {
        const idx = state.players.findIndex(p => p.id === me.id)
        if (idx === -1 || !canPick(state, idx)) { setPicking(false); return }

        const expectedVersion = state.version ?? 0
        const newState = state.phase === 'heroDraft'
          ? applyHeroPick(state, idx, ref)
          : applyPick(state, idx, ref)
        newState.version = expectedVersion + 1

        const { data, error } = await supabase
          .from('draft_rooms')
          .update({ state: newState })
          .eq('id', code)
          .eq('state->>version', expectedVersion)
          .select('id')

        if (error) { // transient/network — drop this attempt, let the user retry
          const { data: fresh } = await supabase.from('draft_rooms').select('state').eq('id', code).single()
          if (fresh) setRoomState(fresh.state)
          setPicking(false)
          return
        }
        if (data && data.length > 0) return // committed; realtime will broadcast + clear `picking`

        // Version conflict: someone wrote first. Re-sync to the latest state and retry.
        const { data: fresh } = await supabase.from('draft_rooms').select('state').eq('id', code).single()
        if (!fresh) { setPicking(false); return }
        state = fresh.state
        setRoomState(fresh.state)
        await new Promise(r => setTimeout(r, 30 + Math.random() * 70)) // jitter to avoid livelock
      }
      setPicking(false) // exhausted retries — release so the user can try again
    } finally {
      inFlightRef.current = false
    }
  }, [me, code])

  const handleTimeout = useCallback(() => {
    if (!isMyTurn || myPack.length === 0 || pickingRef.current) return
    doPick(myPack[Math.floor(Math.random() * myPack.length)])
  }, [isMyTurn, myPack, doPick])

  async function handleRejoin(e) {
    e.preventDefault()
    const name = rejoinName.trim()
    if (!name) { setRejoinError('Enter your display name'); return }
    const { data } = await supabase.from('draft_rooms').select('state').eq('id', code).single()
    if (!data) { setRejoinError('Room not found'); return }
    const player = data.state.players.find(p => p.name.toLowerCase() === name.toLowerCase())
    if (!player) { setRejoinError('No player with that name in this room'); return }
    const identity = { id: player.id, name: player.name, isHost: data.state.players[0]?.id === player.id }
    localStorage.setItem(`player_${code}`, JSON.stringify(identity))
    setMe(identity); setNeedsRejoin(false); setRejoinError('')
  }

  if (needsRejoin && !me) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <form onSubmit={handleRejoin} className="bg-gray-900 rounded-xl p-6 w-full max-w-sm space-y-4">
          <h2 className="font-semibold text-lg">Rejoin draft</h2>
          <p className="text-sm text-gray-400">Enter the name you used for room <span className="text-amber-400 font-mono">{code}</span>.</p>
          <input value={rejoinName} onChange={e => setRejoinName(e.target.value)} placeholder="Your display name" autoFocus
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
          {rejoinError && <p className="text-red-400 text-sm">{rejoinError}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={() => navigate('/')} className="flex-1 py-2 rounded-lg bg-gray-800 text-sm">Home</button>
            <button type="submit" className="flex-1 py-2 rounded-lg bg-amber-500 text-gray-950 font-semibold text-sm">Rejoin</button>
          </div>
        </form>
      </div>
    )
  }

  if (!roomState || !me) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading draft…</div>

  if (myIndex === -1) return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-4 text-gray-400">
      <p>You are not a participant in this draft.</p>
      <button onClick={() => navigate('/')} className="px-4 py-2 bg-gray-800 rounded-lg text-sm">Go home</button>
    </div>
  )

  const packSize = myPack.length
  const activePicks = isHeroPhase ? myHeroPicks : myPicks
  const heroTarget = isHeroPhase ? (roomState.heroTarget ?? 0) : 0
  const heroPickerName = (isHeroPhase && heroTurnIdx >= 0) ? (roomState.players[heroTurnIdx]?.name ?? '') : ''
  // Progress within the current phase. Hero draft: how many heroes you have toward the
  // target. Card draft: a full pack's size isn't fixed (hero toggle, set composition),
  // so derive it from picks made this round.
  let currentPickNum, totalPicks
  if (isHeroPhase) {
    currentPickNum = myHeroPicks.length // heroes you already have (target shown alongside)
    totalPicks = heroTarget
  } else {
    const fullPack = roomState.round ? Math.round((myPicks.length + packSize) / roomState.round) : packSize
    currentPickNum = Math.max(1, fullPack - packSize + 1)
    totalPicks = fullPack
  }

  return (
    <div className="min-h-screen flex flex-col pb-16 md:pb-0">
      {reconnecting && <div className="bg-yellow-600 text-yellow-100 text-center text-sm py-2">Reconnecting…</div>}
      {fetchErrors.length > 0 && (
        <div className="bg-red-900/50 border border-red-700 text-red-300 text-sm px-4 py-2">
          Failed to load: {fetchErrors.join(', ')}
        </div>
      )}

      {/* Top bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center gap-3 shrink-0">
        <span className="font-mono text-amber-400 font-bold text-sm">{code}</span>
        <span className="text-gray-500 text-xs">{isHeroPhase ? 'Hero Draft' : `Round ${roomState.round}/4`}</span>
        <span className="ml-auto text-sm">
          {isMyTurn
            ? <span className="text-green-400 font-medium text-sm">Your turn</span>
            : <span className="text-gray-500 text-xs">Waiting…</span>}
        </span>
      </div>

      {/* Player status — compact on mobile */}
      <PlayerStatus players={roomState.players}
        picks={isHeroPhase ? (roomState.heroPicks ?? {}) : roomState.picks}
        waitingFor={isHeroPhase ? (heroTurnIdx >= 0 ? [heroTurnIdx] : []) : roomState.waitingFor}
        meId={me.id} />

      {/* Desktop: side-by-side layout */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="flex items-baseline gap-3 mb-3">
            {isHeroPhase ? (
              <>
                <h2 className="font-semibold text-lg text-amber-400">Hero Draft</h2>
                <span className="text-sm text-gray-500">You have {currentPickNum} / {totalPicks} heroes</span>
              </>
            ) : (
              <>
                <h2 className="font-semibold text-lg">Pack {roomState.round}</h2>
                <span className="text-sm text-gray-500">Pick {currentPickNum}</span>
              </>
            )}
          </div>
          {isHeroPhase && (
            <p className="mb-3 text-sm text-gray-400">
              Between packs, each player snake-drafts one hero from the shared pool — {heroTarget} in total.
            </p>
          )}
          {isHeroPhase && myHeroPicks.length > 0 && <MyHeroes heroes={myHeroPicks} cardMap={cardMap} label="Heroes you've taken" />}
          {!isHeroPhase && myHeroPicks.length > 0 && <MyHeroes heroes={myHeroPicks} cardMap={cardMap} />}
          {roomState.config?.timerEnabled && roomState.pickDeadline && (
            <PickTimer deadline={roomState.pickDeadline} isMyTurn={isMyTurn} onTimeout={handleTimeout} />
          )}
          {!isMyTurn && (
            <div className="mb-4 bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 text-sm text-gray-400">
              {isHeroPhase
                ? <>Waiting for <span className="text-gray-200">{heroPickerName}</span> to pick a hero…</>
                : 'Waiting for other players to pick…'}
            </div>
          )}
          <CardGrid packRefs={myPack} cardMap={cardMap} onPick={doPick} onHover={setHoverCard} disabled={!isMyTurn || picking} />
        </div>
        <div className="w-80 border-l border-gray-800 flex flex-col">
          <DraftSidebar pickedRefs={activePicks} cardMap={cardMap} round={roomState.round} code={code} />
        </div>
      </div>

      {/* Mobile: tab-based layout */}
      <div className="md:hidden flex-1 overflow-y-auto">
        {mobileTab === 'pack' && (
          <div className="p-3">
            <div className="flex items-baseline gap-2 mb-2">
              <h2 className="font-semibold">{isHeroPhase ? <span className="text-amber-400">Hero Draft</span> : `Pack ${roomState.round}`}</h2>
              <span className="text-xs text-gray-500">{isHeroPhase ? `${currentPickNum} / ${totalPicks} heroes` : `Pick ${currentPickNum}`}</span>
            </div>
            {myHeroPicks.length > 0 && <MyHeroes heroes={myHeroPicks} cardMap={cardMap} label={isHeroPhase ? "Heroes you've taken" : undefined} />}
            {roomState.config?.timerEnabled && roomState.pickDeadline && (
              <PickTimer deadline={roomState.pickDeadline} isMyTurn={isMyTurn} onTimeout={handleTimeout} />
            )}
            {!isMyTurn && (
              <div className="mb-3 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-400">
                {isHeroPhase
                  ? <>Waiting for <span className="text-gray-200">{heroPickerName}</span> to pick a hero…</>
                  : 'Waiting for other players…'}
              </div>
            )}
            <CardGrid packRefs={myPack} cardMap={cardMap} onPick={(ref) => { doPick(ref); setMobileTab('pack') }}
              onHover={() => {}} disabled={!isMyTurn || picking} />
          </div>
        )}
        {mobileTab === 'picks' && (
          <DraftSidebar pickedRefs={activePicks} cardMap={cardMap} round={roomState.round} code={code} />
        )}
        {mobileTab === 'stats' && (
          <div className="p-3">
            <DraftStats pickedRefs={activePicks} cardMap={cardMap} />
          </div>
        )}
      </div>

      {hoverCard && <CardPreview card={hoverCard} />}
      <MobileTabBar tab={mobileTab} setTab={setMobileTab} pickCount={activePicks.length} />
    </div>
  )
}
