import { formatPuzzleRating } from '@libs/game-puzzle-shared-ts/rating';
import type {
  PuzzleGameLogEntry,
  PuzzleStats,
} from '@libs/game-puzzle-shared-ts/stats';
import { Trans } from '@lingui/solid/macro';
import { GameHistoryScreen } from '@pkgs/ui-root-client-ts/game-history-screen';
import { H2 } from '@pkgs/ui-root-client-ts/heading';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { Sparkline } from '@pkgs/ui-root-client-ts/sparkline';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Show } from 'solid-js';
import { PuzzleGameLog } from './puzzle-game-log';
import { PuzzleRatingHistory } from './puzzle-rating-history';
import { PuzzleStatsCards } from './puzzle-stats-cards';

/** Whether the player's puzzle history is still unknown or known. */
export type PuzzleStatsStatus = 'loading' | 'ready';

export type PuzzleStatsScreenViewProps = {
  readonly status: PuzzleStatsStatus;
  /** Totals, rating and its series; read only once `ready`. */
  readonly stats: PuzzleStats;
  /** Every played puzzle, newest first. */
  readonly gameLog: readonly PuzzleGameLogEntry[];
  readonly onSelectEntry: (entry: PuzzleGameLogEntry) => void;
  /**
   * The host's bar already names this screen (the personal stats route), so
   * the body does not repeat the title.
   */
  readonly titled?: boolean | undefined;
  /** The host already scrolls and pads the page (the personal stats route). */
  readonly nested?: boolean | undefined;
};

/** The headline: the player's puzzle rating and the shape of its history. */
function PuzzleStatsSummary(props: { stats: PuzzleStats }): JSX.Element {
  return (
    <StackVertical align="center" gap="sm">
      <P variant="caption">
        <Trans>Puzzle rating</Trans>
      </P>
      <H2 size="title" numeral testId="chess-stats-elo">
        {formatPuzzleRating({
          rating: props.stats.currentRating,
          provisional: props.stats.provisional,
        })}
      </H2>
      <StackVertical width="full" maxWidth="form">
        <Sparkline
          values={props.stats.ratingSeries}
          testId="chess-stats-sparkline"
        />
      </StackVertical>
    </StackVertical>
  );
}

/**
 * Puzzle stats, presentational: the player's rating, its trend, their
 * totals and the game log, or one activity indicator while unknown.
 * `PuzzleStatsBody` wires it to the synced history.
 */
export function PuzzleStatsScreenView(
  props: PuzzleStatsScreenViewProps
): JSX.Element {
  const ready = (): boolean => props.status === 'ready';
  return (
    <GameHistoryScreen
      screenId="chess-stats"
      nested={props.nested}
      title={props.titled === false ? undefined : <Trans>Puzzle stats</Trans>}
      summary={
        <Show when={ready()}>
          <PuzzleStatsSummary stats={props.stats} />
        </Show>
      }
      trend={
        <Show when={ready()}>
          <PuzzleRatingHistory entries={props.gameLog} />
        </Show>
      }
      statistics={
        <Show when={ready()}>
          <PuzzleStatsCards stats={props.stats} />
        </Show>
      }
    >
      <Show when={ready()} fallback={<LoadingState />}>
        <PuzzleGameLog
          entries={props.gameLog}
          onSelectEntry={props.onSelectEntry}
        />
      </Show>
    </GameHistoryScreen>
  );
}
