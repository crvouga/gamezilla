import type { State } from '@gamezilla/peer-store/types';
import { Pressable } from 'react-native';
import { Stack, Text } from '@gamezilla/shared/ui';
import { useTheme } from '@gamezilla/shared/ui';

export function TicTacToeBoard({
  state,
  onCellClick,
  readonly,
}: {
  state: State;
  onCellClick?: ((cell: number) => void) | undefined;
  readonly?: boolean | undefined;
}) {
  const board = (state['board'] ?? []) as Array<null | string>;
  const winner = state['winner'] as null | string;
  const status = state['status'] as string;
  const theme = useTheme();

  const rows = [
    board.slice(0, 3),
    board.slice(3, 6),
    board.slice(6, 9),
  ];

  return (
    <Stack spacing={1} align="center">
      {rows.map((row, rowIdx) => (
        <Stack key={rowIdx} direction="horizontal" spacing={1}>
          {row.map((mark, colIdx) => {
            const cellIdx = rowIdx * 3 + colIdx;
            const isDisabled = readonly || !!winner || status === 'completed' || !!mark;

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
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: textColor }}>
                  {mark ?? ''}
                </Text>
              </Pressable>
            );
          })}
        </Stack>
      ))}
      {winner && (
        <Text variant="label" sx={{ mt: 1 }}>
          {winner === 'draw' ? 'Draw' : `${winner} wins`}
        </Text>
      )}
    </Stack>
  );
}
