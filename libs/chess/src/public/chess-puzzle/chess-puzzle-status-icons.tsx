import { Trans } from '@lingui/solid/macro';
import {
  ClockIcon,
  PlayIcon,
  SearchIcon,
  Spinner,
  useTheme,
  WifiOffIcon,
} from '@pkgs/ui';
import type { JSX } from 'solid-js';

import type { ChessPuzzleStatusKind } from '../../shared/puzzle-session/status-kind';
import { ChessPuzzleStatusBadge } from './chess-puzzle-status-badge';

export type { ChessPuzzleStatusKind };

const SIZE = 22;

const ROOT_STYLE: JSX.CSSProperties = {
  width: `${SIZE}px`,
  height: `${SIZE}px`,
  'align-items': 'center',
  'justify-content': 'center',
};

type BadgeKind = 'failed' | 'solved' | 'skipped';

function badgeColors(
  theme: ReturnType<typeof useTheme>,
  kind: BadgeKind
): { bg: string; fg: string } {
  const c = theme.colors;
  if (kind === 'failed') return { bg: c.destructive, fg: c.onDestructive };
  if (kind === 'solved') return { bg: c.warning, fg: c.onWarning };
  return { bg: c.surfaceMuted, fg: c.textSecondary };
}

function badgeMark(kind: BadgeKind): JSX.Element {
  if (kind === 'failed') {
    return <Trans id="chess.puzzleStatus.failedMark">✕</Trans>;
  }
  if (kind === 'solved') {
    return <Trans id="chess.puzzleStatus.solvedMark">★</Trans>;
  }
  return <Trans id="chess.puzzleStatus.skippedMark">»</Trans>;
}

function iconBox(child: JSX.Element): JSX.Element {
  return (
    <div class="box" style={ROOT_STYLE}>
      {child}
    </div>
  );
}

export function ChessPuzzleStatusIcon(props: {
  kind: ChessPuzzleStatusKind;
}): JSX.Element {
  const theme = useTheme();
  switch (props.kind) {
    case 'loading':
      return iconBox(<Spinner size="small" />);
    case 'empty':
    case 'limited':
      return iconBox(<SearchIcon size={SIZE - 4} color="textSecondary" />);
    case 'offline':
      return iconBox(<WifiOffIcon size={SIZE - 4} color="textSecondary" />);
    case 'waiting':
      return iconBox(<ClockIcon size={SIZE - 4} color="textSecondary" />);
    case 'started':
      return iconBox(<PlayIcon size={SIZE - 4} color="textSecondary" />);
    default: {
      const { bg, fg } = badgeColors(theme, props.kind);
      return iconBox(
        <ChessPuzzleStatusBadge bg={bg} fg={fg} mark={badgeMark(props.kind)} />
      );
    }
  }
}
