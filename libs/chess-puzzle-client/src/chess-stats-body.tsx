import type { ChessPuzzleGameLogEntry } from '@libs/chess-puzzle-shared/chess-puzzle-stats';
import { Trans } from '@lingui/solid/macro';
import { GameHistoryScreen } from '@pkgs/ui-root-client/game-history-screen';
import type { JSX } from 'solid-js';
import { ChessGameLog } from './chess-game-log';
import { ChessPuzzleRatingChip } from './chess-puzzle-rating-chip';
import { ChessPuzzleStatsCards } from './chess-puzzle-stats-cards';
import { ChessRatingHistory } from './chess-rating-history';
import { ChessRatingSparkline } from './chess-rating-sparkline';
import { useChessPuzzleHistory } from './use-chess-puzzle-history';

export function ChessStatsBody(props: {
  readonly onSelectEntry: (entry: ChessPuzzleGameLogEntry) => void;
  /**
   * The host's bar already names this screen (the personal stats route), so
   * the body does not repeat the title.
   */
  readonly titled?: boolean | undefined;
}): JSX.Element {
  const history = useChessPuzzleHistory();
  return (
    <GameHistoryScreen
      screenId="chess-stats"
      title={props.titled === false ? undefined : <Trans>Puzzle stats</Trans>}
      summary={
        <div class="box items-center gap-2">
          <ChessPuzzleRatingChip
            rating={history.stats().currentRating}
            provisional={history.stats().provisional}
            variant="primary"
            testID="chess-stats-elo"
          />
          <ChessRatingSparkline
            series={history.stats().ratingSeries}
            testID="chess-stats-sparkline"
          />
        </div>
      }
      trend={<ChessRatingHistory entries={history.gameLog()} />}
      statistics={<ChessPuzzleStatsCards stats={history.stats()} />}
    >
      <ChessGameLog
        entries={history.gameLog()}
        onSelectEntry={props.onSelectEntry}
      />
    </GameHistoryScreen>
  );
}
