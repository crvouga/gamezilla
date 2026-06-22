import { DefineBackButton } from '@libs/spaces/client/nav/spaces-nav-context';
import { useSpaceRoomDispatch } from '@libs/spaces/client/room/use-space-room-selector';
import { Box, ScrollView, Text, useTheme } from '@pkgs/ui';
import { Trans } from '@lingui/react/macro';
import { useCallback, type ReactNode } from 'react';

import { CHESS_SCREEN, SetChessMainMenuScreen } from '../../shared/chess-main-menu';
import { ChessEloSparkline } from './chess-elo-sparkline';
import { ChessGameLog } from './chess-game-log';
import { ChessPuzzleEloChip } from './chess-puzzle-elo-chip';
import { ChessPuzzleStatsCards } from './chess-puzzle-stats-cards';
import { useChessPuzzleHistory } from './use-chess-puzzle-history';

const CONTENT_MAX_WIDTH = 720;

export function ChessStatsScreen(): ReactNode {
  const theme = useTheme();
  const dispatch = useSpaceRoomDispatch();
  const { stats, gameLog } = useChessPuzzleHistory();

  const backToRoot = useCallback(() => {
    dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.root }));
  }, [dispatch]);

  return (
    <>
      <DefineBackButton onPress={backToRoot} />
      <ScrollView sx={{ flex: 1, alignSelf: 'stretch' }}>
        <Box
          sx={{ alignSelf: 'center', maxWidth: CONTENT_MAX_WIDTH, gap: 4, p: 4, pb: 8 }}
          style={{ width: '100%' }}
        >
          <Text
            variant="title"
            style={{ color: theme.colors.text }}
            label={<Trans>Puzzle stats</Trans>}
          />
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
            style={{ color: theme.colors.text }}
            label={<Trans>Game log</Trans>}
          />
          <ChessGameLog entries={gameLog} />
        </Box>
      </ScrollView>
    </>
  );
}
