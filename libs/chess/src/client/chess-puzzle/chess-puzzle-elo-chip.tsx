import { Box, Text, useTheme } from '@pkgs/ui';
import type { ReactNode } from 'react';

export type ChessPuzzleEloChipProps = {
  elo: number;
  variant?: 'primary' | 'muted';
  testID?: string;
};

export function ChessPuzzleEloChip({
  elo,
  variant = 'primary',
  testID,
}: ChessPuzzleEloChipProps): ReactNode {
  const theme = useTheme();
  const isPrimary = variant === 'primary';
  return (
    <Box
      testID={testID}
      sx={{ px: 2, py: 1, borderRadius: 6 }}
      style={{
        backgroundColor: isPrimary
          ? theme.colors.tintMuted
          : theme.colors.surfaceMuted,
      }}
    >
      <Text
        variant={isPrimary ? 'bodyBold' : 'caption'}
        style={{
          color: isPrimary ? theme.colors.tint : theme.colors.textSecondary,
        }}
        label={String(elo)}
      />
    </Box>
  );
}
