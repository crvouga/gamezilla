import { DefineBackButton } from '@libs/spaces/public/nav/spaces-nav-context';
import { useSpaceRoomDispatch } from '@libs/spaces/public/room/use-space-room-selector';
import { Trans } from '@lingui/react/macro';
import {
  Box,
  componentDataSet,
  MAIN_MENU_SCREEN_MAX_WIDTH,
  MainMenuScreenHeader,
  ScrollView,
  Text,
} from '@pkgs/ui';
import { type ReactNode, useCallback } from 'react';

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

export function ChessStatsScreen(): ReactNode {
  const dispatch = useSpaceRoomDispatch();
  const { stats, gameLog } = useChessPuzzleHistory();

  const backToRoot = useCallback(() => {
    dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.root }));
  }, [dispatch]);

  const openReview = useCallback(
    (entry: ChessPuzzleGameLogEntry) => {
      dispatch(
        SetChessSelectedReviewPuzzle({
          puzzleId: entry.puzzleId,
          solveIdx: 0,
        })
      );
      dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.statsReview }));
    },
    [dispatch]
  );

  return (
    <>
      <DefineBackButton onPress={backToRoot} />
      <ScrollView
        sx={{ flex: 1, alignSelf: 'stretch' }}
        {...componentDataSet('ChessStatsScreen', { screen: 'chess-stats' })}
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
              elo={stats.currentElo}
              variant="primary"
              testID="chess-stats-elo"
            />
            <ChessEloSparkline
              series={stats.eloSeries}
              testID="chess-stats-sparkline"
            />
          </Box>
          <ChessPuzzleStatsCards stats={stats} />
          <Text
            variant="heading"
            sx={{ color: 'text' }}
            label={<Trans>Game log</Trans>}
          />
          <ChessGameLog entries={gameLog} onSelectEntry={openReview} />
        </Box>
      </ScrollView>
    </>
  );
}
