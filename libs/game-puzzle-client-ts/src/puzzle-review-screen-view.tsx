import type { PuzzleOutcomeKind } from '@libs/game-puzzle-shared-ts/interaction-entities';
import { Trans } from '@lingui/solid/macro';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { GameReviewScreen } from '@pkgs/ui-root-client-ts/game-review-screen';
import { type JSX, Match, Show, Switch } from 'solid-js';

/**
 * `unselected`: no puzzle picked from the log; `unavailable`: the puzzle is
 * not on this device yet; `ready`: its board and line can be replayed.
 */
export type PuzzleReviewStatus = 'unselected' | 'unavailable' | 'ready';

export type PuzzleReviewScreenViewProps = {
  readonly status: PuzzleReviewStatus;
  /** How the reviewed attempt went, once the log has it. */
  readonly outcome?: PuzzleOutcomeKind | null | undefined;
  /** The puzzle's own rating; 0 before the puzzle is known. */
  readonly puzzleRating: number;
  /** The replay board and its move list, shown when `ready`. */
  readonly board?: JSX.Element;
  /** The host already scrolls and pads the page (the personal stats route). */
  readonly nested?: boolean | undefined;
};

/** How the reviewed attempt went; "Puzzle review" before the log has it. */
function ReviewTitle(props: {
  outcome: PuzzleOutcomeKind | null | undefined;
}): JSX.Element {
  return (
    <Switch fallback={<Trans>Puzzle review</Trans>}>
      <Match when={props.outcome === 'solved'}>
        <Trans>Solved</Trans>
      </Match>
      <Match when={props.outcome === 'failed'}>
        <Trans>Failed</Trans>
      </Match>
      <Match when={props.outcome === 'abandoned'}>
        <Trans>Abandoned</Trans>
      </Match>
    </Switch>
  );
}

/** The puzzle's own rating, once the puzzle is known. */
function ReviewSubtitle(props: { rating: number }): JSX.Element {
  return (
    <Show when={props.rating > 0}>
      <Trans>Puzzle rated {props.rating}</Trans>
    </Show>
  );
}

/**
 * Puzzle review, presentational: replays one logged puzzle on its board,
 * titled by how the attempt went, or says why it cannot (nothing picked,
 * or not synced yet). The board arrives as a slot from the container.
 */
export function PuzzleReviewScreenView(
  props: PuzzleReviewScreenViewProps
): JSX.Element {
  return (
    <Show
      when={props.status !== 'unselected'}
      fallback={
        <EmptyState
          title={<Trans>No puzzle selected</Trans>}
          body={<Trans>Pick one from the game log.</Trans>}
        />
      }
    >
      <GameReviewScreen
        screenId="chess-stats-review"
        nested={props.nested}
        title={<ReviewTitle outcome={props.outcome} />}
        subtitle={
          props.puzzleRating > 0 ? (
            <ReviewSubtitle rating={props.puzzleRating} />
          ) : undefined
        }
      >
        <Show
          when={props.status === 'ready'}
          fallback={
            <EmptyState
              title={<Trans>Puzzle unavailable</Trans>}
              body={
                <Trans>
                  This puzzle is not in your local feed yet. Try again after
                  sync.
                </Trans>
              }
            />
          }
        >
          {props.board}
        </Show>
      </GameReviewScreen>
    </Show>
  );
}
