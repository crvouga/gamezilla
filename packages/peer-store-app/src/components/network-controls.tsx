const btnClass =
  'rounded-lg border border-white/15 bg-white/8 px-4 py-2 text-sm font-semibold text-white/70 transition-colors hover:bg-white/14 hover:text-white disabled:opacity-30'

export function NetworkControls({
  onPause,
  onResume,
  onDrop,
  onAdvance,
  onDisconnect,
  onReconnect,
  isPaused,
  disconnectedPeers,
}: {
  onPause: () => void
  onResume: () => void
  onDrop: () => void
  onAdvance: () => void
  onDisconnect: (peerId: string) => void
  onReconnect: (peerId: string) => void
  isPaused: boolean
  disconnectedPeers: Set<string>
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-black/40 p-5">
      <h4 className="text-sm font-bold text-white/40 uppercase">
        Network Controls
      </h4>
      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          className={btnClass}
          onClick={onPause}
          disabled={isPaused}
        >
          Pause
        </button>
        <button
          type="button"
          className={btnClass}
          onClick={onResume}
          disabled={!isPaused}
        >
          Resume
        </button>
        <button type="button" className={btnClass} onClick={onDrop}>
          Drop next
        </button>
        <button type="button" className={btnClass} onClick={onAdvance}>
          Advance 5s
        </button>
      </div>
      <div className="flex flex-wrap gap-2.5">
        {['player-x', 'player-o', 'worker'].map((peerId) => {
          const is_disconnected = disconnectedPeers.has(peerId)
          return (
            <button
              key={peerId}
              type="button"
              className={btnClass}
              onClick={() =>
                is_disconnected
                  ? onReconnect(peerId)
                  : onDisconnect(peerId)
              }
            >
              {is_disconnected ? `Reconnect ${peerId}` : `Disconnect ${peerId}`}
            </button>
          )
        })}
      </div>
    </div>
  )
}
