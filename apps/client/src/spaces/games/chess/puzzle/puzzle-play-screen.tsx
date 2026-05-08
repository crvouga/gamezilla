import { ChessBoard } from '@gamezilla/client/spaces/games/chess/chess-board';
import { useSpaceDispatch } from '@gamezilla/client/spaces/room/use-space-room-selector';
import {
  CHESS_SCREEN,
  SetChessMainMenuScreen,
} from '@gamezilla/domain/spaces/games/chess/chess-main-menu';
import { Box, IconButton, IconSymbol, Text, useTheme } from '@gamezilla/lib/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, type ReactNode } from 'react';

const SAMPLE_PUZZLE_FEN =
  'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3' as const;

const BOARD_MAX_WIDTH = 720;
const BACK_BUTTON_SIZE = 40;
const BACK_ROW_PADDING_TOP = 12;
const BACK_ROW_PADDING_HORIZONTAL = 12;

function BackButtonRow({ onPress }: { onPress: () => void }): ReactNode {
  const { t } = useLingui();
  const theme = useTheme();
  return (
    <Box
      style={{
        alignSelf: 'stretch',
        alignItems: 'flex-start',
        height: BACK_BUTTON_SIZE + BACK_ROW_PADDING_TOP,
        paddingHorizontal: BACK_ROW_PADDING_HORIZONTAL,
        paddingTop: BACK_ROW_PADDING_TOP,
      }}
    >
      <IconButton
        size={BACK_BUTTON_SIZE}
        background="surface"
        onPress={onPress}
        accessibilityLabel={t`Back`}
      >
        <IconSymbol
          name="chevron.right"
          size={20}
          color={theme.colors.text}
          style={{ transform: [{ scaleX: -1 }] }}
        />
      </IconButton>
    </Box>
  );
}

export function PuzzlePlayScreen(): ReactNode {
  const dispatch = useSpaceDispatch();

  const backToPuzzleMenu = useCallback(() => {
    dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.puzzle }));
  }, [dispatch]);

  return (
    <Box sx={{ alignSelf: 'stretch' }}>
      <BackButtonRow onPress={backToPuzzleMenu} />

      <Box
        sx={{
          alignSelf: 'center',
          maxWidth: BOARD_MAX_WIDTH,
          gap: 4,
          pb: 8,
        }}
        style={{ width: '100%' }}
      >
        <Box sx={{ gap: 2, alignItems: 'center' }}>
          <Text
            variant="title"
            sx={{ textAlign: 'center' }}
            label={<Trans>Puzzle</Trans>}
          />
          <Text
            variant="body"
            sx={{ color: 'textSecondary', textAlign: 'center', opacity: 0.75 }}
            label={<Trans>Play</Trans>}
          />
        </Box>

        <ChessBoard
          fen={SAMPLE_PUZZLE_FEN}
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
    </Box>
  );
}
