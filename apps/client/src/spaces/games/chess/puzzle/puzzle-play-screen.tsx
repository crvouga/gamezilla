import { Box, Text, useTheme } from '@gamezilla/lib/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

function PlaceholderChessBoard(): ReactNode {
  const theme = useTheme();
  const size = 320;
  const cell = size / 8;
  const light = theme.colors.surface;
  const dark = theme.colors.surfaceVariant ?? theme.colors.surface;

  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: 4,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'border',
      }}
    >
      {Array.from({ length: 8 }).map((_, row) => (
        <Box key={row} sx={{ flexDirection: 'row' }}>
          {Array.from({ length: 8 }).map((__, col) => {
            const isDark = (row + col) % 2 === 1;
            return (
              <Box
                key={col}
                style={{
                  width: cell,
                  height: cell,
                  backgroundColor: isDark ? dark : light,
                }}
              />
            );
          })}
        </Box>
      ))}
    </Box>
  );
}

export function PuzzlePlayScreen(): ReactNode {
  return (
    <Box sx={{ alignItems: 'center', gap: 4, px: 4, py: 6 }}>
      <Text variant="title" label={<Trans>Puzzle (placeholder)</Trans>} />
      <PlaceholderChessBoard />
      <Text
        variant="caption"
        sx={{ color: 'textSecondary', textAlign: 'center' }}
        label={<Trans>This is a placeholder puzzle board.</Trans>}
      />
    </Box>
  );
}

