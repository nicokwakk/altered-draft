export default function PlayerStatus({ players, picks, waitingFor, meId }) {
  return (
    <div className="bg-surface border-b border-line px-3 py-1.5 flex gap-2 overflow-x-auto scrollbar-none">
      {players.map((player, i) => {
        const pickCount = picks[String(i)]?.length ?? 0
        const isPicking = waitingFor?.includes(i)
        const isMe = player.id === meId

        return (
          <div key={player.id}
            className={`flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-lg text-xs transition-colors ${
              isPicking ? 'bg-accent/10 border border-accent/30' : 'bg-surface2'
            }`}>
            <span className={`font-medium truncate max-w-[80px] ${isMe ? 'text-accent' : 'text-ink2'}`}>
              {player.name}
            </span>
            <span className="text-faint">{pickCount}</span>
            {isPicking && <span className="w-1.5 h-1.5 rounded-full bg-accent2 animate-pulse shrink-0" />}
          </div>
        )
      })}
    </div>
  )
}
