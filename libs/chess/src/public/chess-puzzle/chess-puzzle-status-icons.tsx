import { Trans } from '@lingui/solid/macro';
import { Box, Spinner, type SxProps, useTheme } from '@pkgs/ui';
import type { JSX } from 'solid-js';

import type { ChessPuzzleStatusKind } from '../../shared/puzzle-session/status-kind';
import { ChessPuzzleStatusBadge } from './chess-puzzle-status-badge';

export type { ChessPuzzleStatusKind };

const SIZE = 22;

const PIECE_WHITE = '#ffffff';
const PIECE_BLACK = '#1a1a1a';

const ROOT_SX: SxProps = {
  width: SIZE,
  height: SIZE,
  alignItems: 'center',
  justifyContent: 'center',
};

const WHITE_SQUARE_SX: SxProps = {
  width: 14,
  height: 14,
  borderWidth: 1.5,
  borderColor: PIECE_WHITE,
};

const BLACK_SQUARE_SX: SxProps = {
  width: 14,
  height: 14,
  backgroundColor: PIECE_BLACK,
};

const CENTER_DOT_SX: SxProps = {
  position: 'absolute',
  width: 6,
  height: 6,
  borderRadius: 3,
  backgroundColor: PIECE_BLACK,
};

function outcomeColors(
  theme: ReturnType<typeof useTheme>,
  kind: 'correct' | 'wrong' | 'solved'
): { bg: string; fg: string } {
  const c = theme.colors;
  if (kind === 'correct') return { bg: c.success, fg: c.onSuccess };
  if (kind === 'wrong') return { bg: c.destructive, fg: c.onDestructive };
  return { bg: c.warning, fg: c.onWarning };
}

function outcomeMark(kind: 'correct' | 'wrong' | 'solved'): JSX.Element {
  if (kind === 'correct') {
    return <Trans id="chess.puzzleStatus.correctMark">✓</Trans>;
  }
  if (kind === 'wrong') {
    return <Trans id="chess.puzzleStatus.wrongMark">✕</Trans>;
  }
  return <Trans id="chess.puzzleStatus.solvedMark">★</Trans>;
}

export function ChessPuzzleStatusIcon(props: {
  kind: ChessPuzzleStatusKind;
}): JSX.Element {
  const theme = useTheme();
  if (props.kind === 'loading') {
    return (
      <Box sx={ROOT_SX}>
        <Spinner size="small" />
      </Box>
    );
  }
  if (props.kind === 'whiteToMove') {
    return (
      <Box sx={ROOT_SX}>
        <Box sx={WHITE_SQUARE_SX} />
        <Box sx={CENTER_DOT_SX} />
      </Box>
    );
  }
  if (props.kind === 'blackToMove') {
    return (
      <Box sx={ROOT_SX}>
        <Box sx={BLACK_SQUARE_SX} />
      </Box>
    );
  }
  const { bg, fg } = outcomeColors(theme, props.kind);
  return (
    <Box sx={ROOT_SX}>
      <ChessPuzzleStatusBadge bg={bg} fg={fg} mark={outcomeMark(props.kind)} />
    </Box>
  );
}
