import type { ChessPuzzleGameLogEntry } from '@libs/chess-puzzle-shared/chess-puzzle-stats';
import { Handles } from '@libs/test-ids-shared/handles';
import { Trans } from '@lingui/solid/macro';
import { useTheme } from '@pkgs/ui-root-client/theme-context';
import { createMemo, For, type JSX, Show } from 'solid-js';

/** How many of the latest rated puzzles the history lists. */
const RATING_HISTORY_LENGTH = 10;

function signedDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}

function HistoryPoint(props: {
  readonly entry: ChessPuzzleGameLogEntry;
  readonly index: number;
}): JSX.Element {
  const theme = useTheme();
  const color = (): string =>
    props.entry.delta > 0
      ? theme.colors.success
      : props.entry.delta < 0
        ? theme.colors.destructive
        : theme.colors.textSecondary;
  return (
    <div class="box items-center gap-0.5 px-2 py-1 rounded-sm bg-surface-muted">
      <p
        class="text textBodyBold text-text"
        data-testid={Handles.chessStatsRatingHistoryPoint(props.index)}
      >
        {props.entry.ratingAfter}
      </p>
      <p class="text textCaption" style={{ color: color() }}>
        {signedDelta(props.entry.delta)}
      </p>
    </div>
  );
}

export type ChessRatingHistoryProps = {
  /** The game log, newest first; only its rated attempts are drawn. */
  readonly entries: readonly ChessPuzzleGameLogEntry[];
};

/**
 * The player's rating after each of their latest rated puzzles, oldest on
 * the left, each with the change that puzzle made: how they are doing over
 * time, in numbers the sparkline only draws.
 */
export function ChessRatingHistory(
  props: ChessRatingHistoryProps
): JSX.Element {
  const latest = createMemo(() =>
    props.entries
      .filter((entry) => entry.rated)
      .slice(0, RATING_HISTORY_LENGTH)
      .reverse()
  );
  return (
    <Show when={latest().length > 0}>
      <div class="box gap-2 self-stretch">
        <p class="text textCaption text-text-secondary">
          <Trans>Rating after each puzzle</Trans>
        </p>
        <div class="box flex-row flex-wrap gap-2">
          <For each={latest()}>
            {(entry, index) => <HistoryPoint entry={entry} index={index()} />}
          </For>
        </div>
      </div>
    </Show>
  );
}
