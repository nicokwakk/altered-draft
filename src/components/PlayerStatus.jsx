export default function PlayerStatus({ players, picks, waitingFor, meId }) {
  return (
    <div className="bg-gray-900 border-b border-gray-800 px-6 py-2 flex gap-4 overflow-x-auto">
      {players.map((player, i) => {
        const pickCount = picks[String(i)]?.length ?? 0
        const isPicking = waitingFor?.includes(i)
        const isMe = player.id === meId

        return (
          <div
            key={player.id}
            className={`flex items-center gap-2 shrink-0 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              isPicking ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-gray-800'
            }`}
          >
            <span className={`font-medium ${isMe ? 'text-amber-400' : 'text-gray-300'}`}>
              {player.name}
            </span>
            <span className="text-xs text-gray-500">{pickCount} picks</span>
            {isPicking && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Picking now" />
            )}
          </div>
        )
      })}
    </div>
  )
}
