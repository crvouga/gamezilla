import { DefineBackButton } from '@libs/spaces/public/nav/spaces-nav-context';
import { useSpaceRoomDispatch } from '@libs/spaces/public/room/use-space-room-selector';
import { Trans } from '@lingui/solid/macro';
import {
  MAIN_MENU_SCREEN_MAX_WIDTH,
  MainMenuScreenHeader,
  ScrollView,
} from '@pkgs/ui';
import type { JSX } from 'solid-js';

import {
  CHESS_SCREEN,
  SetChessMainMenuScreen,
  SetChessSelectedReviewPuzzle,
} from '../chess-main-menu';
import type { ChessPuzzleGameLogEntry } from '../chess-puzzle-stats';
import { ChessGameLog } from './chess-game-log';
import { ChessPuzzleRatingChip } from './chess-puzzle-rating-chip';
import { ChessPuzzleStatsCards } from './chess-puzzle-stats-cards';
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
