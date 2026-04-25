import { Assert } from '@gamezilla/lib/assert'
import type { State } from '../store/types'

const crash: Assert = Assert.crash()

/** Reads one tic-tac-toe cell after runtime validation (no type assertions). */
export function ticTacToeBoardCell(state: State, index: number): null | string {
  const b = state['board']
  crash.array(b, 'state.board must be an array')
  crash.ok(index >= 0 && index < 9, 'board index must be 0..8', { index })
  const c = b[index]
  crash.ok(
    c === null || c === 'X' || c === 'O',
    'board cell must be null, X, or O',
    { index, cell: c },
  )
  return c
}
