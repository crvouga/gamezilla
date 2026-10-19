import type { PuzzleGameLogEntry } from '@libs/game-puzzle-shared/stats';
import { Trans } from '@lingui/solid/macro';
import { GameHistoryScreen } from '@pkgs/ui-root-client/game-history-screen';
import type { JSX } from 'solid-js';
import { PuzzleGameLog } from './puzzle-game-log';
import { PuzzleRatingChip } from './puzzle-rating-chip';
import { PuzzleRatingHistory } from './puzzle-rating-history';
import { PuzzleRatingSparkline } from './puzzle-rating-sparkline';
import { PuzzleStatsCards } from './puzzle-stats-cards';
import { usePuzzleHistory } from './use-puzzle-history';

export function PuzzleStatsBody(props: {
  readonly onSelectEntry: (entry: PuzzleGameLogEntry) => void;
  /**
   * The host's bar already names this screen (the personal stats route), so
   * the body does not repeat the title.
   */
  readonly titled?: boolean | undefined;
}): JSX.Element {
  const history = usePuzzleHistory();
  return (
    <GameHistoryScreen
      screenId="chess-stats"
      title={props.titled === false ? undefined : <Trans>Puzzle stats</Trans>}
      summary={
        <div class="box items-center gap-2">
          <PuzzleRatingChip
            rating={history.stats().currentRating}
            provisional={history.stats().provisional}
            variant="primary"
            testID="chess-stats-elo"
          />
          <PuzzleRatingSparkline
            series={history.stats().ratingSeries}
            testID="chess-stats-sparkline"
          />
        </div>
      }
      trend={<PuzzleRatingHistory entries={history.gameLog()} />}
      statistics={<PuzzleStatsCards stats={history.stats()} />}
    >
      <PuzzleGameLog
        entries={history.gameLog()}
        onSelectEntry={props.onSelectEntry}
      />
    </GameHistoryScreen>
  );
}
