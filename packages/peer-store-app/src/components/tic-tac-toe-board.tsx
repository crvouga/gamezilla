import type { State } from '@gamezilla/peer-store/types'

export function TicTacToeBoard({
  state,
  onCellClick,
  readonly,
}: {
  state: State
  onCellClick?: ((cell: number) => void) | undefined
  readonly?: boolean | undefined
}) {
  const board = (state['board'] ?? []) as Array<null | string>
  const winner = state['winner'] as null | string
  const status = state['status'] as string

  return (
    <div className="flex flex-col items-center gap-2.5">
      <div className="grid grid-cols-3 gap-1.5">
        {board.map((mark, i) => (
          <button
            key={i}
            type="button"
            disabled={readonly || !!winner || status === 'completed' || !!mark}
            onClick={() => onCellClick?.(i)}
            className={`flex h-14 w-14 items-center justify-center rounded-lg text-lg font-bold transition-colors ${
              mark
                ? mark === 'X'
                  ? 'bg-sky-500/25 text-sky-300'
                  : 'bg-amber-500/25 text-amber-300'
                : 'bg-white/8 text-white/30 hover:bg-white/15'
            } ${readonly ? 'cursor-default' : 'cursor-pointer'}`}
          >
            {mark ?? ''}
          </button>
        ))}
      </div>
      {winner && (
        <p className="text-sm font-semibold text-white/60">
          {winner === 'draw' ? 'Draw' : `${winner} wins`}
        </p>
      )}
    </div>
  )
}
