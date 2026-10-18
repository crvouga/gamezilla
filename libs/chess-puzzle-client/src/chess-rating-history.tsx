import type { PuzzleGameLogEntry } from '@libs/game-puzzle-shared/stats';
import { Handles } from '@libs/test-ids-shared/handles';
import { Trans } from '@lingui/solid/macro';
import { createMemo, For, type JSX, Show } from 'solid-js';

/** How many of the latest rated puzzles the history lists. */
const RATING_HISTORY_LENGTH = 10;

function signedDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}

function HistoryPoint(props: {
  readonly entry: PuzzleGameLogEntry;
  readonly index: number;
}): JSX.Element {
  return (
    <div class="box items-center gap-0.5 px-2 py-1 rounded-sm bg-surface-muted">
      <p
        class="text textLabel textNumeral"
        data-testid={Handles.chessStatsRatingHistoryPoint(props.index)}
      >
        {props.entry.ratingAfter}
      </p>
      <p
        class="text textFootnote textNumeral"
        classList={{
          'text-success': props.entry.delta > 0,
          'text-destructive': props.entry.delta < 0,
        }}
      >
        {signedDelta(props.entry.delta)}
      </p>
    </div>
  );
}

export type ChessRatingHistoryProps = {
  /** The game log, newest first; only its rated attempts are drawn. */
  readonly entries: readonly PuzzleGameLogEntry[];
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
        <p class="text textCaption">
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
