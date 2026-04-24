import { Assert } from '@gamezilla/lib/assert';
import type { State } from '@gamezilla/peer-store/types';
import { Pressable, Stack, Text, useTheme } from '@gamezilla/lib/ui';

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
  const theme = useTheme();

  const rows = [board.slice(0, 3), board.slice(3, 6), board.slice(6, 9)];

  return (
    <Stack spacing={1} align="center">
      {rows.map((row, rowIdx) => (
        <Stack key={rowIdx} direction="horizontal" spacing={1}>
          {row.map((mark, colIdx) => {
            const cellIdx = rowIdx * 3 + colIdx;
            const isDisabled =
              readonly || !!winner || status === 'completed' || !!mark;

            const cellBg = mark
              ? mark === 'X'
                ? theme.colors.info + '40'
                : theme.colors.warning + '40'
              : theme.colors.surface;
            const textColor = mark
              ? mark === 'X'
                ? theme.colors.info
                : theme.colors.warning
              : theme.colors.textSecondary;

            return (
              <Pressable
                key={cellIdx}
                disabled={isDisabled}
                onPress={() => onCellClick?.(cellIdx)}
                style={({ pressed }) => [
                  {
                    width: 56,
                    height: 56,
                    borderRadius: 8,
                    backgroundColor: cellBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                  pressed && !isDisabled && { opacity: 0.7 },
                ]}
              >
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: 'bold',
                    color: textColor,
                  }}
                  label={mark ?? ''}
                />
              </Pressable>
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
