import { Assert } from '@gamezilla/lib/assert';
import type { State } from '@gamezilla/peer-store/types';
import { Stack, Text } from '@gamezilla/lib/ui';
import { TicTacToeCell } from './tic-tac-toe-cell';

const crash: Assert = Assert.crash();

function readBoard(state: State): Array<null | string> {
  const b = state['board'];
  crash.array(b, 'state.board must be an array');
  crash.ok(b.length === 9, 'board must have 9 cells');
  const out: Array<null | string> = [];
  for (const c of b) {
    crash.ok(
      c === null || c === 'X' || c === 'O',
      'board cell must be null, X, or O',
    );
    out.push(c);
  }
  return out;
}

function readWinner(state: State): null | string {
  const w = state['winner'];
  if (w === null || w === undefined) return null;
  crash.string(w, 'winner must be string when set');
  crash.ok(
    w === 'X' || w === 'O' || w === 'draw',
    'winner must be X, O, or draw',
  );
  return w;
}

function readStatus(state: State): string {
  const s = state['status'];
  crash.string(s, 'status must be string');
  return s;
}

export function TicTacToeBoard({
  state,
  onCellClick,
  readonly,
}: {
  state: State;
  onCellClick?: ((cell: number) => void) | undefined;
  readonly?: boolean | undefined;
}) {
  const board = readBoard(state);
  const winner = readWinner(state);
  const status = readStatus(state);
  const isLocked = readonly || !!winner || status === 'completed';

  const rows = [board.slice(0, 3), board.slice(3, 6), board.slice(6, 9)];

  return (
    <Stack spacing={1} align="center">
      {rows.map((row, rowIdx) => (
        <Stack key={rowIdx} direction="horizontal" spacing={1}>
          {row.map((mark, colIdx) => {
            const cellIdx = rowIdx * 3 + colIdx;
            return (
              <TicTacToeCell
                key={cellIdx}
                cellIdx={cellIdx}
                mark={mark}
                disabled={isLocked || !!mark}
                onPress={onCellClick}
              />
            );
          })}
        </Stack>
      ))}
      {winner && (
        <Text
          variant="label"
          sx={{ mt: 1 }}
          label={winner === 'draw' ? 'Draw' : `${winner} wins`}
        />
      )}
    </Stack>
  );
}
