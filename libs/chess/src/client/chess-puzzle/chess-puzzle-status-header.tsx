import { Trans } from '@lingui/react/macro';
import { Box, Text, useTheme } from '@pkgs/ui';
import type { ReactNode } from 'react';

import {
  ChessPuzzleStatusIcon,
  type ChessPuzzleStatusKind,
} from './chess-puzzle-status-icons';

import { ChessPuzzleEloChip } from './chess-puzzle-elo-chip';

const HEADER_ROW_HEIGHT = 22;

export { HEADER_ROW_HEIGHT };

function statusLabel(kind: ChessPuzzleStatusKind): ReactNode {
  switch (kind) {
    case 'whiteToMove':
      return <Trans>White to move</Trans>;
    case 'blackToMove':
      return <Trans>Black to move</Trans>;
    case 'correct':
      return <Trans>Correct</Trans>;
    case 'wrong':
      return <Trans>Wrong</Trans>;
    case 'solved':
      return <Trans>Solved</Trans>;
    default:
      return null;
  }
}

export type ChessPuzzleStatusHeaderProps = {
  kind: ChessPuzzleStatusKind;
  playerElo?: number;
  puzzleRating?: number;
};

export function ChessPuzzleStatusHeader({
  kind,
  playerElo,
  puzzleRating,
}: ChessPuzzleStatusHeaderProps): ReactNode {
  const theme = useTheme();
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        height: HEADER_ROW_HEIGHT,
        alignSelf: 'stretch',
      }}
    >
      <ChessPuzzleStatusIcon kind={kind} />
      <Text
        variant="bodyBold"
        style={{ flex: 1, color: theme.colors.text }}
        label={statusLabel(kind)}
      />
      <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
        {playerElo !== undefined && playerElo > 0 ? (
          <ChessPuzzleEloChip
            elo={playerElo}
            variant="primary"
            testID="chess-puzzle-player-elo"
          />
        ) : null}
        {puzzleRating !== undefined && puzzleRating > 0 ? (
          <ChessPuzzleEloChip elo={puzzleRating} variant="muted" />
        ) : null}
      </Box>
    </Box>
  );
}
