import { ChessBoard } from '@gamezilla/client/spaces/games/chess/board';
import { MainMenuScreen } from '@gamezilla/client/spaces/games/main-menu-screen';
import {
  CHESS_MAIN_MENU_PUZZLE,
  SetChessMainMenuScreen,
} from '@gamezilla/domain/spaces/space-module';
import { Box, Text } from '@gamezilla/lib/ui';
import { Trans } from '@lingui/react/macro';
import { useCallback, type ReactNode } from 'react';

const SAMPLE_PUZZLE_FEN =
  'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3' as const;

export function PuzzlePlayScreen(args: {
  dispatch: (cmd: unknown) => void;
}): ReactNode {
  const { dispatch } = args;

  const backToPuzzleMenu = useCallback(() => {
    dispatch(SetChessMainMenuScreen({ screen: CHESS_MAIN_MENU_PUZZLE }));
  }, [dispatch]);

  return (
    <MainMenuScreen
      title={<Trans>Puzzle</Trans>}
      subtitle={<Trans>Play</Trans>}
      helper={
        <Box sx={{ alignItems: 'center', gap: 4, mt: 2 }}>
          <ChessBoard
            fen={SAMPLE_PUZZLE_FEN}
            size={320}
            orientation="white"
            interactive
            showCoordinates
            highlightLastMove
            highlightLegalMoves
          />
          <Text
            variant="caption"
            sx={{ color: 'textSecondary', textAlign: 'center' }}
            label={<Trans>Drag or tap pieces to play the puzzle.</Trans>}
          />
        </Box>
      }
      items={[]}
      onPressBack={backToPuzzleMenu}
    />
  );
}
