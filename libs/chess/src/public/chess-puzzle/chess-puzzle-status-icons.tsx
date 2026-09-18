import { Trans } from '@lingui/solid/macro';
import { SearchIcon, Spinner, useTheme, WifiOffIcon } from '@pkgs/ui';
import type { JSX } from 'solid-js';

import type { ChessPuzzleStatusKind } from '../../shared/puzzle-session/status-kind';
import { ChessPuzzleStatusBadge } from './chess-puzzle-status-badge';

export type { ChessPuzzleStatusKind };

const SIZE = 22;

const PIECE_WHITE = '#ffffff';
const PIECE_BLACK = '#1a1a1a';

const ROOT_STYLE: JSX.CSSProperties = {
  width: `${SIZE}px`,
  height: `${SIZE}px`,
  'align-items': 'center',
  'justify-content': 'center',
};

const WHITE_SQUARE_STYLE: JSX.CSSProperties = {
  width: '14px',
  height: '14px',
  'border-width': '1.5px',
  'border-color': PIECE_WHITE,
};

const BLACK_SQUARE_STYLE: JSX.CSSProperties = {
  width: '14px',
  height: '14px',
  'background-color': PIECE_BLACK,
};

const CENTER_DOT_STYLE: JSX.CSSProperties = {
  position: 'absolute',
  width: '6px',
  height: '6px',
  'border-radius': '3px',
  'background-color': PIECE_BLACK,
};

function outcomeColors(
  theme: ReturnType<typeof useTheme>,
  kind: 'wrong' | 'solved'
): { bg: string; fg: string } {
  const c = theme.colors;
  if (kind === 'wrong') return { bg: c.destructive, fg: c.onDestructive };
  return { bg: c.warning, fg: c.onWarning };
}

function outcomeMark(kind: 'wrong' | 'solved'): JSX.Element {
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
      <div class="box" style={ROOT_STYLE}>
        <Spinner size="small" />
      </div>
    );
  }
  if (props.kind === 'empty') {
    return (
      <div class="box" style={ROOT_STYLE}>
        <SearchIcon size={SIZE - 4} color="textSecondary" />
      </div>
    );
  }
  if (props.kind === 'offline') {
    return (
      <div class="box" style={ROOT_STYLE}>
        <WifiOffIcon size={SIZE - 4} color="textSecondary" />
      </div>
    );
  }
  if (props.kind === 'limited') {
    return (
      <div class="box" style={ROOT_STYLE}>
        <SearchIcon size={SIZE - 4} color="textSecondary" />
      </div>
    );
  }
  if (props.kind === 'whiteToMove') {
    return (
      <div class="box" style={ROOT_STYLE}>
        <div class="box" style={WHITE_SQUARE_STYLE} />
        <div class="box" style={CENTER_DOT_STYLE} />
      </div>
    );
  }
  if (props.kind === 'blackToMove') {
    return (
      <div class="box" style={ROOT_STYLE}>
        <div class="box" style={BLACK_SQUARE_STYLE} />
      </div>
    );
  }
  const { bg, fg } = outcomeColors(theme, props.kind);
  return (
    <div class="box" style={ROOT_STYLE}>
      <ChessPuzzleStatusBadge bg={bg} fg={fg} mark={outcomeMark(props.kind)} />
    </div>
  );
}
