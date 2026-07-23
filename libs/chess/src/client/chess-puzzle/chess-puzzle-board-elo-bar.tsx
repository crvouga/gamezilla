import { Trans } from '@lingui/react/macro';
import { Box, Text, useTheme } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { ChessPuzzleEloChip } from './chess-puzzle-elo-chip';

/** Fixed reserve so the board frame can fit the square under this bar. */
export const BOARD_ELO_BAR_HEIGHT = 28;

export type ChessPuzzleBoardEloBarProps = {
  rating: number;
};

export function ChessPuzzleBoardEloBar({
  rating,
}: ChessPuzzleBoardEloBarProps): ReactNode {
  const theme = useTheme();

  return (
    <Box
      testID="chess-puzzle-board-elo-bar"
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        height: BOARD_ELO_BAR_HEIGHT,
        alignSelf: 'stretch',
      }}
    >
      <Text
        variant="caption"
        style={{ color: theme.colors.textSecondary }}
        label={<Trans>Puzzle</Trans>}
      />
      <ChessPuzzleEloChip
        elo={rating}
        variant="muted"
        testID="chess-puzzle-board-elo"
      />
    </Box>
  );
}
