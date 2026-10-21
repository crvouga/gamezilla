import type { PuzzleGameLogEntry } from '@libs/game-puzzle-shared/stats';
import { Handles } from '@libs/test-ids-shared/handles';
import { Trans } from '@lingui/solid/macro';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client/stack';
import { Surface } from '@pkgs/ui-root-client/surface';
import { P } from '@pkgs/ui-root-client/text';
import type { ColorTone } from '@pkgs/ui-root-shared/token-names';
import { createMemo, For, type JSX, Show } from 'solid-js';

/** How many of the latest rated puzzles the history lists. */
const RATING_HISTORY_LENGTH = 10;

function signedDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}

function deltaTone(delta: number): ColorTone | undefined {
  if (delta > 0) return 'success';
  if (delta < 0) return 'destructive';
  return undefined;
}

function HistoryPoint(props: {
  readonly entry: PuzzleGameLogEntry;
  readonly index: number;
}): JSX.Element {
  return (
    <Surface
      tone="muted"
      radius="sm"
      align="center"
      paddingX="sm"
      paddingY="xs"
    >
      <P
        variant="label"
        numeral
        testId={Handles.chessStatsRatingHistoryPoint(props.index)}
      >
        {props.entry.ratingAfter}
      </P>
      <P variant="footnote" numeral tone={deltaTone(props.entry.delta)}>
        {signedDelta(props.entry.delta)}
      </P>
    </Surface>
  );
}

export type PuzzleRatingHistoryProps = {
  /** The game log, newest first; only its rated attempts are drawn. */
  readonly entries: readonly PuzzleGameLogEntry[];
};

/**
 * The player's rating after each of their latest rated puzzles, oldest on
 * the left, each with the change that puzzle made: how they are doing over
 * time, in numbers the sparkline only draws.
 */
export function PuzzleRatingHistory(
  props: PuzzleRatingHistoryProps
): JSX.Element {
  const latest = createMemo(() =>
    props.entries
      .filter((entry) => entry.rated)
      .slice(0, RATING_HISTORY_LENGTH)
      .reverse()
  );
  return (
    <Show when={latest().length > 0}>
      <StackVertical gap="sm" self="stretch">
        <P variant="caption">
          <Trans>Rating after each puzzle</Trans>
        </P>
        <StackHorizontal wrap gap="sm">
          <For each={latest()}>
            {(entry, index) => <HistoryPoint entry={entry} index={index()} />}
          </For>
        </StackHorizontal>
      </StackVertical>
    </Show>
  );
}
