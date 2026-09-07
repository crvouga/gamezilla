import { DefineBackButton } from '@libs/spaces/public/nav/spaces-nav-context';
import { useSpaceRoomDispatch } from '@libs/spaces/public/room/use-space-room-selector';
import { Trans } from '@lingui/solid/macro';
import {
  Box,
  MAIN_MENU_SCREEN_MAX_WIDTH,
  MainMenuScreenHeader,
  ScrollView,
  Text,
} from '@pkgs/ui';
import type { JSX } from 'solid-js';

import {
  CHESS_SCREEN,
  SetChessMainMenuScreen,
  SetChessSelectedReviewPuzzle,
} from '../chess-main-menu';
import type { ChessPuzzleGameLogEntry } from '../chess-puzzle-stats';
import { ChessEloSparkline } from './chess-elo-sparkline';
import { ChessGameLog } from './chess-game-log';
import { ChessPuzzleEloChip } from './chess-puzzle-elo-chip';
import { ChessPuzzleStatsCards } from './chess-puzzle-stats-cards';
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
        sx={{ flex: 1, alignSelf: 'stretch' }}
        dataSet={{ screen: 'chess-stats' }}
      >
        <Box
          sx={{
            gap: 4,
            p: 4,
            pb: 8,
            alignSelf: 'center',
            width: '100%',
            maxWidth: MAIN_MENU_SCREEN_MAX_WIDTH,
          }}
        >
          <MainMenuScreenHeader title={<Trans>Puzzle stats</Trans>} />
          <Box sx={{ alignItems: 'center', gap: 2 }}>
            <ChessPuzzleEloChip
              elo={history.stats.currentElo}
              variant="primary"
              testID="chess-stats-elo"
            />
            <ChessEloSparkline
              series={history.stats.eloSeries}
              testID="chess-stats-sparkline"
            />
          </Box>
          <ChessPuzzleStatsCards stats={history.stats} />
          <Text
            variant="heading"
            sx={{ color: 'text' }}
            label={<Trans>Game log</Trans>}
          />
          <ChessGameLog entries={history.gameLog} onSelectEntry={openReview} />
        </Box>
      </ScrollView>
    </>
  );
}
