import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { fetchSet } from '../lib/cardData.js'
import { applyPick } from '../lib/draftLogic.js'
import CardGrid from '../components/CardGrid.jsx'
import DraftSidebar from '../components/DraftSidebar.jsx'
import PlayerStatus from '../components/PlayerStatus.jsx'
import CardPreview from '../components/CardPreview.jsx'

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

  const stateRef = useRef(null)
  stateRef.current = roomState

  useEffect(() => {
    const stored = localStorage.getItem(`player_${code}`)
    if (!stored) { navigate('/'); return }
    setMe(JSON.parse(stored))
  }, [code, navigate])

  useEffect(() => {
    supabase.from('draft_rooms').select('state').eq('id', code).single()
      .then(async ({ data, error }) => {
        if (error || !data) { navigate('/'); return }
        const state = data.state
        setRoomState(state)

        if (state.phase === 'done') { navigate(`/room/${code}/results`); return }

        if (state.config.customPool) {
          // Custom pool: build a minimal cardMap from all known references
          const allRefs = new Set([
            ...Object.values(state.packs).flat(),
            ...Object.values(state.picks).flat(),
            ...(state.remainingPacks ?? []).flatMap(rp => Object.values(rp).flat()),
          ])
          const minimal = {}
          for (const ref of allRefs) {
            minimal[ref] = { reference: ref, name: ref, faction: 'XX', rarity: 'C', cardType: '', imagePath: null }
          }
          setCardMap(minimal)
          return
        }

        if (state.config.sets?.length) {
          const errors = []
          const maps = {}
          await Promise.all(state.config.sets.map(async setCode => {
            try {
              const cards = await fetchSet(setCode, state.config.lang || 'EN')
              for (const c of cards) maps[c.reference] = c
            } catch (e) {
              errors.push(`${setCode}: ${e.message}`)
            }
          }))
          if (errors.length) setFetchErrors(errors)
          setCardMap(maps)
        }
      })
  }, [code, navigate])

  useEffect(() => {
    const channel = supabase
      .channel(`draft-${code}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'draft_rooms', filter: `id=eq.${code}` },
        payload => {
          const state = payload.new.state
          setRoomState(state)
          setPicking(false)
          if (state.phase === 'done') navigate(`/room/${code}/results`)
        })
      .on('system', {}, ev => {
        if (ev.event === 'CHANNEL_ERROR' || ev.event === 'CLOSED') setReconnecting(true)
        if (ev.event === 'SUBSCRIBED') setReconnecting(false)
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [code, navigate])

  const myIndex = roomState && me
    ? roomState.players.findIndex(p => p.id === me.id)
    : -1

  const isMyTurn = myIndex !== -1 && roomState?.waitingFor?.includes(myIndex)
  const myPack = (myIndex !== -1 && roomState) ? (roomState.packs[String(myIndex)] ?? []) : []
  const myPicks = (myIndex !== -1 && roomState) ? (roomState.picks[String(myIndex)] ?? []) : []

  const handlePick = useCallback(async (ref) => {
    if (!roomState || picking || !isMyTurn || myIndex === -1) return
    setPicking(true)

    const currentState = stateRef.current
    const newState = applyPick(currentState, myIndex, ref)

    // Version-based conflict detection: only update if version matches
    const currentVersion = currentState.version ?? 0
    newState.version = currentVersion + 1

    const { error } = await supabase
      .from('draft_rooms')
      .update({ state: newState })
      .eq('id', code)

    if (error) {
      console.error('Pick failed:', error)
      // Refetch latest state and let realtime update handle it
      const { data } = await supabase.from('draft_rooms').select('state').eq('id', code).single()
      if (data) setRoomState(data.state)
      setPicking(false)
    }
  }, [roomState, picking, isMyTurn, myIndex, code])

  if (!roomState || !me) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading draft…</div>
  }

  if (myIndex === -1) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4 text-gray-400">
        <p>You are not a participant in this draft.</p>
        <button onClick={() => navigate('/')} className="px-4 py-2 bg-gray-800 rounded-lg text-sm hover:bg-gray-700">
          Go home
        </button>
      </div>
    )
  }

  const packSize = myPack.length
  const currentPickNum = (12 - packSize) + 1

  return (
    <div className="min-h-screen flex flex-col">
      {reconnecting && (
        <div className="bg-yellow-600 text-yellow-100 text-center text-sm py-2">
          Reconnecting to server…
        </div>
      )}
      {fetchErrors.length > 0 && (
        <div className="bg-red-900/50 border border-red-700 text-red-300 text-sm px-4 py-2">
          Failed to load card data for: {fetchErrors.join(', ')}
        </div>
      )}

      <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-4">
        <span className="font-mono text-amber-400 font-bold">{code}</span>
        <span className="text-gray-500 text-sm">Round {roomState.round} of 4</span>
        <span className="ml-auto text-sm">
          {isMyTurn
            ? <span className="text-green-400 font-medium">Your turn to pick</span>
            : <span className="text-gray-500">Waiting for other players…</span>}
        </span>
      </div>

      <PlayerStatus players={roomState.players} picks={roomState.picks} waitingFor={roomState.waitingFor} meId={me.id} />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="flex items-baseline gap-3 mb-4">
            <h2 className="font-semibold text-lg">Pack {roomState.round}</h2>
            <span className="text-sm text-gray-500">Pick {currentPickNum} of {packSize + currentPickNum - 1}</span>
          </div>

          {!isMyTurn && (
            <div className="mb-4 bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 text-sm text-gray-400">
              Waiting for other players to pick…
            </div>
          )}

          <CardGrid
            packRefs={myPack}
            cardMap={cardMap}
            onPick={handlePick}
            onHover={setHoverCard}
            disabled={!isMyTurn || picking}
          />
        </div>

        <div className="w-80 border-l border-gray-800 flex flex-col">
          <DraftSidebar
            pickedRefs={myPicks}
            cardMap={cardMap}
            round={roomState.round}
            code={code}
          />
        </div>
      </div>

      {hoverCard && <CardPreview card={hoverCard} />}
    </div>
  )
}
