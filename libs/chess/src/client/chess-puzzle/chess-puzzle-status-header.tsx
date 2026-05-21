import { Box, defaultColors, Text } from '@pkgs/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

import {
  ChessPuzzleStatusIcon,
  type ChessPuzzleStatusKind,
} from './chess-puzzle-status-icons';

const HEADER_ROW_HEIGHT = 22;

export { HEADER_ROW_HEIGHT };

// The status header always renders inside the (always-light) speech bubble,
// so colors are pinned to the light palette to stay readable in dark mode.
const BUBBLE_TEXT = defaultColors.light.text;
const BUBBLE_TEXT_MUTED = defaultColors.light.textSecondary;
// `ColorTokens` has no `surfaceVariant`; fall back to the bubble's border
// token for a subtle inline-chip background that contrasts with the surface.
const BUBBLE_CHIP_BG = defaultColors.light.border;

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
        style={{ flex: 1, color: BUBBLE_TEXT }}
        label={statusLabel(kind)}
      />
      {rating !== undefined && rating > 0 ? (
        <Box
          sx={{ px: 2, py: 1, borderRadius: 6 }}
          style={{ backgroundColor: BUBBLE_CHIP_BG }}
        >
          <Text
            variant="caption"
            style={{ color: BUBBLE_TEXT_MUTED }}
            label={String(rating)}
          />
        </Box>
      ) : null}
    </Box>
  );
}
