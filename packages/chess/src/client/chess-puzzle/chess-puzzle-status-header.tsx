import { Box, Text } from '@gamezilla/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

import {
  ChessPuzzleStatusIcon,
  type ChessPuzzleStatusKind,
} from './chess-puzzle-status-icons';

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
  rating?: number;
};

export function ChessPuzzleStatusHeader({
  kind,
  rating,
}: ChessPuzzleStatusHeaderProps): ReactNode {
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
        sx={{ flex: 1, color: 'text' }}
        label={statusLabel(kind)}
      />
      {rating !== undefined && rating > 0 ? (
        <Box
          sx={{
            px: 2,
            py: 1,
            borderRadius: 6,
            background: 'surfaceVariant',
          }}
        >
          <Text variant="caption" label={String(rating)} />
        </Box>
      ) : null}
    </Box>
  );
}
