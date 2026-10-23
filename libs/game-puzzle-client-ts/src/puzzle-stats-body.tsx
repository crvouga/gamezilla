import { formatPuzzleRating } from '@libs/game-puzzle-shared-ts/rating';
import type { PuzzleGameLogEntry } from '@libs/game-puzzle-shared-ts/stats';
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
import { usePuzzleHistory } from './use-puzzle-history';

type PuzzleHistory = ReturnType<typeof usePuzzleHistory>;

/** The headline: the player's puzzle rating and the shape of its history. */
function PuzzleStatsSummary(props: { history: PuzzleHistory }): JSX.Element {
  const stats = () => props.history.stats();
  return (
    <StackVertical align="center" gap="sm">
      <P variant="caption">
        <Trans>Puzzle rating</Trans>
      </P>
      <H2 size="title" numeral testId="chess-stats-elo">
        {formatPuzzleRating({
          rating: stats().currentRating,
          provisional: stats().provisional,
        })}
      </H2>
      <StackVertical width="full" maxWidth="form">
        <Sparkline
          values={stats().ratingSeries}
          testId="chess-stats-sparkline"
        />
      </StackVertical>
    </StackVertical>
  );
}

export function PuzzleStatsBody(props: {
  readonly onSelectEntry: (entry: PuzzleGameLogEntry) => void;
  /**
   * The host's bar already names this screen (the personal stats route), so
   * the body does not repeat the title.
   */
  readonly titled?: boolean | undefined;
  /** The host already scrolls and pads the page (the personal stats route). */
  readonly nested?: boolean | undefined;
}): JSX.Element {
  const history = usePuzzleHistory();
  const ready = (): boolean => !history.loading();
  return (
    <GameHistoryScreen
      screenId="chess-stats"
      nested={props.nested}
      title={props.titled === false ? undefined : <Trans>Puzzle stats</Trans>}
      summary={
        <Show when={ready()}>
          <PuzzleStatsSummary history={history} />
        </Show>
      }
      trend={
        <Show when={ready()}>
          <PuzzleRatingHistory entries={history.gameLog()} />
        </Show>
      }
      statistics={
        <Show when={ready()}>
          <PuzzleStatsCards stats={history.stats()} />
        </Show>
      }
    >
      <Show when={ready()} fallback={<LoadingState />}>
        <PuzzleGameLog
          entries={history.gameLog()}
          onSelectEntry={props.onSelectEntry}
        />
      </Show>
    </GameHistoryScreen>
  );
}
