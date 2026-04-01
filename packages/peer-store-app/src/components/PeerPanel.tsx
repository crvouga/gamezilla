import type { Event, State } from '@gamezilla/peer-store/types'
import type { PeerId } from '../simulator/playground'
import { StateInspector } from './StateInspector'
import { TicTacToeBoard } from './TicTacToeBoard'

export function PeerPanel({
  peerId,
  displayState,
  committedState,
  events,
  isOnline,
  isBadActor,
  player,
  onCellClick,
}: {
  peerId: PeerId
  displayState: State
  committedState: State
  events: Event[]
  isOnline: boolean
  isBadActor: boolean
  player: 'X' | 'O' | null
  onCellClick?: ((cell: number) => void) | undefined
}) {
  const is_worker = player === null
  const has_optimistic =
    JSON.stringify(displayState) !== JSON.stringify(committedState)

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/50 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold">
          {is_worker ? 'Worker' : `Player ${player}`}
        </h3>
        <div className="flex items-center gap-2">
          {isBadActor && (
            <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[0.6rem] font-bold text-red-400">
              BAD ACTOR
            </span>
          )}
          <span
            className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-red-400'}`}
          />
        </div>
      </div>

      <TicTacToeBoard
        state={displayState}
        onCellClick={onCellClick}
        readonly={is_worker}
      />

      <div className="flex items-center gap-2 text-[0.6rem]">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          committed
        </span>
        {has_optimistic && (
          <span className="flex items-center gap-1 text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            optimistic
          </span>
        )}
      </div>

      <StateInspector
        committedState={committedState}
        displayState={displayState}
      />

      <div className="max-h-24 overflow-y-auto">
        <p className="mb-1 text-[0.6rem] font-semibold text-white/40 uppercase">
          Events ({events.length})
        </p>
        {events.length === 0 && (
          <p className="text-[0.6rem] text-white/20">none</p>
        )}
        {events.slice(-6).map((e, i) => (
          <div key={i} className="text-[0.6rem] text-white/50">
            {e.type}
          </div>
        ))}
      </div>
    </div>
  )
}
