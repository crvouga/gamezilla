import type { ChessPuzzleGameLogEntry } from '@libs/chess-puzzle-shared/chess-puzzle-stats';
import {
  CHESS_SCREEN,
  SetChessMainMenuScreen,
  SetChessSelectedReviewPuzzle,
} from '@libs/chess-root-shared/chess-main-menu';
import { DefineBackButton } from '@libs/spaces-client/spaces-nav-context';
import { useSpaceRoomDispatch } from '@libs/spaces-client/use-space-room-selector';
import { Trans } from '@lingui/solid/macro';
import { MAIN_MENU_SCREEN_MAX_WIDTH } from '@pkgs/ui-root-client/main-menu-screen';
import { MainMenuScreenHeader } from '@pkgs/ui-root-client/main-menu-screen-header';
import { ScrollView } from '@pkgs/ui-root-client/scroll-view';
import type { JSX } from 'solid-js';
import { ChessGameLog } from './chess-game-log';
import { ChessPuzzleRatingChip } from './chess-puzzle-rating-chip';
import { ChessPuzzleStatsCards } from './chess-puzzle-stats-cards';
import { ChessRatingHistory } from './chess-rating-history';
import { ChessRatingSparkline } from './chess-rating-sparkline';
import { useChessPuzzleHistory } from './use-chess-puzzle-history';

export function ChessStatsScreen(): JSX.Element {
  const dispatch = useSpaceRoomDispatch();
  const history = useChessPuzzleHistory();

  const backToRoot = (): void => {
    dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.root }));
  };

  const openReview = (entry: ChessPuzzleGameLogEntry): void => {
    dispatch(
      SetChessSelectedReviewPuzzle({
        puzzleId: entry.puzzleId,
        solveIdx: 0,
      })
    );
    dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.statsReview }));
  };

  return (
    <>
      <DefineBackButton onPress={backToRoot} />
      <ScrollView
        contentClass="flex-1 self-stretch"
        dataSet={{ screen: 'chess-stats' }}
      >
        <div
          class="box gap-4 p-4 pb-8 self-center w-full"
          style={{ 'max-width': `${MAIN_MENU_SCREEN_MAX_WIDTH}px` }}
        >
          <MainMenuScreenHeader title={<Trans>Puzzle stats</Trans>} />
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
          <ChessRatingHistory entries={history.gameLog()} />
          <ChessPuzzleStatsCards stats={history.stats()} />
          <h3 class="text textHeading text-text">{<Trans>Game log</Trans>}</h3>
          <ChessGameLog
            entries={history.gameLog()}
            onSelectEntry={openReview}
          />
        </div>
      </ScrollView>
    </>
  );
}
