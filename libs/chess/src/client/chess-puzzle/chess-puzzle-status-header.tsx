import { Trans } from '@lingui/react/macro';
import { Box, Text, useTheme } from '@pkgs/ui';
import type { ReactNode } from 'react';

import {
  ChessPuzzleStatusIcon,
  type ChessPuzzleStatusKind,
} from './chess-puzzle-status-icons';

import { ChessPuzzleEloChip } from './chess-puzzle-elo-chip';

const HEADER_ROW_HEIGHT = 22;
const ELO_PLACEHOLDER = 1200;

export { HEADER_ROW_HEIGHT };

function statusLabel(kind: ChessPuzzleStatusKind): ReactNode {
  switch (kind) {
    case 'loading':
      return <Trans>Loading puzzle…</Trans>;
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

function EloChipSlot(args: {
  elo: number;
  variant: 'primary' | 'muted';
  visible: boolean;
  testID?: string;
}): ReactNode {
  const chip = (
    <ChessPuzzleEloChip
      elo={args.elo}
      variant={args.variant}
      {...(args.testID !== undefined ? { testID: args.testID } : {})}
    />
  );
  if (args.visible) return chip;
  return (
    <Box style={{ opacity: 0 }} pointerEvents="none">
      <ChessPuzzleEloChip elo={ELO_PLACEHOLDER} variant={args.variant} />
    </Box>
  );
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
  const showPlayerChip =
    kind !== 'loading' && playerElo !== undefined && playerElo > 0;
  const showPuzzleChip =
    kind !== 'loading' && puzzleRating !== undefined && puzzleRating > 0;

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
        <EloChipSlot
          elo={playerElo ?? ELO_PLACEHOLDER}
          variant="primary"
          visible={showPlayerChip}
          testID="chess-puzzle-player-elo"
        />
        <EloChipSlot
          elo={puzzleRating ?? ELO_PLACEHOLDER}
          variant="muted"
          visible={showPuzzleChip}
        />
      </Box>
    </Box>
  );
}
