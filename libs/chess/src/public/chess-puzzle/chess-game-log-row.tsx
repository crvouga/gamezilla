import { Trans } from '@lingui/solid/macro';
import {
  ChevronRightIcon,
  CircleCheckIcon,
  useRelativeTimeLabel,
  useTheme,
  XIcon,
} from '@pkgs/ui';
import type { JSX } from 'solid-js';

import type { ChessPuzzleGameLogEntry } from '../chess-puzzle-stats';

function formatSignedDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

function GameLogTitle(props: {
  solved: boolean;
  puzzleRating: number;
}): JSX.Element {
  if (props.solved) return <Trans>Solved · {props.puzzleRating}</Trans>;
  return <Trans>Abandoned · {props.puzzleRating}</Trans>;
}

function GameLogCaption(props: {
  puzzleId: string;
  timeLabel: string;
}): JSX.Element {
  return (
    <Trans>
      {props.puzzleId} · {props.timeLabel}
    </Trans>
  );
}

export type ChessGameLogRowProps = {
  entry: ChessPuzzleGameLogEntry;
  onClick: () => void;
};

export function ChessGameLogRow(props: ChessGameLogRowProps): JSX.Element {
  const theme = useTheme();
  const solved = props.entry.outcome === 'solved';
  const puzzleRating = props.entry.puzzleRating;
  const timeLabel = useRelativeTimeLabel(() => props.entry.at);
  const deltaColor =
    props.entry.delta > 0
      ? theme.colors.success
      : props.entry.delta < 0
        ? theme.colors.destructive
        : theme.colors.textSecondary;
  const Icon = solved ? CircleCheckIcon : XIcon;

  return (
    <button
      class="clickable clickableTint"
      data-testid={`chess-game-log-row-${props.entry.puzzleId}`}
      type="button"
      onClick={props.onClick}
      role="button"
    >
      <div class="box flex-row items-center gap-2 p-3 rounded-sm bg-surface-muted">
        <Icon size={18} color={solved ? 'success' : 'destructive'} />
        <div class="box flex-1 min-w-[0] gap-1">
          <p
            class="text textBodyBold line-clamp-1 text-text"
            data-testid={`chess-game-log-row-${props.entry.puzzleId}-title`}
          >
            {<GameLogTitle solved={solved} puzzleRating={puzzleRating} />}
          </p>
          <p class="text textCaption line-clamp-1 text-text-secondary">
            {
              <GameLogCaption
                puzzleId={props.entry.puzzleId}
                timeLabel={timeLabel()}
              />
            }
          </p>
        </div>
        <p class="text textBodyBold shrink-0" style={{ color: deltaColor }}>
          {formatSignedDelta(props.entry.delta)}
        </p>
        <ChevronRightIcon size={20} color="icon" />
      </div>
    </button>
  );
}
