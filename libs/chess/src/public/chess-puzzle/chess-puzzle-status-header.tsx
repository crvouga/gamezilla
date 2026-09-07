import { Trans } from '@lingui/solid/macro';
import { Box, Text } from '@pkgs/ui';
import type { JSX } from 'solid-js';

import {
  ChessPuzzleStatusIcon,
  type ChessPuzzleStatusKind,
} from './chess-puzzle-status-icons';

const HEADER_ROW_HEIGHT = 22;

export { HEADER_ROW_HEIGHT };

function statusLabel(kind: ChessPuzzleStatusKind): JSX.Element | null {
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

export type ChessPuzzleStatusHeaderProps = {
  kind: ChessPuzzleStatusKind;
};

export function ChessPuzzleStatusHeader(
  props: ChessPuzzleStatusHeaderProps
): JSX.Element {
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
      <ChessPuzzleStatusIcon kind={props.kind} />
      <Text
        variant="bodyBold"
        sx={{ flex: 1, color: 'text' }}
        label={statusLabel(props.kind)}
      />
    </Box>
  );
}
