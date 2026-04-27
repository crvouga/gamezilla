import { Pressable, Text, useTheme } from '@gamezilla/lib/ui';

export type CellMark = null | string;

export function TicTacToeCell({
  cellIdx,
  mark,
  disabled,
  onPress,
}: {
  cellIdx: number;
  mark: CellMark;
  disabled: boolean;
  onPress?: ((cell: number) => void) | undefined;
}) {
  const theme = useTheme();

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
      disabled={disabled}
      onPress={() => onPress?.(cellIdx)}
      style={({ pressed }) => [
        {
          width: 56,
          height: 56,
          borderRadius: 8,
          backgroundColor: cellBg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        pressed && !disabled && { opacity: 0.7 },
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
}
