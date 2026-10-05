import type { ChessPuzzleStatusKind } from '@libs/chess-puzzle-shared/status-kind';
import { Trans } from '@lingui/solid/macro';
import {
  ClockIcon,
  PlayIcon,
  SearchIcon,
  WifiOffIcon,
} from '@pkgs/ui-root-client/icons';
import { Spinner } from '@pkgs/ui-root-client/spinner';
import { useTheme } from '@pkgs/ui-root-client/theme-context';
import type { JSX } from 'solid-js';
import { ChessPuzzleStatusBadge } from './chess-puzzle-status-badge';

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

/** The glyph for one status; called from JSX so it re-runs when the kind changes. */
function statusGlyph(
  theme: ReturnType<typeof useTheme>,
  kind: ChessPuzzleStatusKind
): JSX.Element {
  switch (kind) {
    case 'loading':
      return <Spinner size="small" />;
    case 'empty':
    case 'limited':
      return <SearchIcon size={SIZE - 4} color="textSecondary" />;
    case 'offline':
      return <WifiOffIcon size={SIZE - 4} color="textSecondary" />;
    case 'waiting':
      return <ClockIcon size={SIZE - 4} color="textSecondary" />;
    case 'started':
      return <PlayIcon size={SIZE - 4} color="textSecondary" />;
    default: {
      const { bg, fg } = badgeColors(theme, kind);
      return <ChessPuzzleStatusBadge bg={bg} fg={fg} mark={badgeMark(kind)} />;
    }
  }
}

export function ChessPuzzleStatusIcon(props: {
  kind: ChessPuzzleStatusKind;
}): JSX.Element {
  const theme = useTheme();
  return (
    <div class="box" style={ROOT_STYLE}>
      {statusGlyph(theme, props.kind)}
    </div>
  );
}
