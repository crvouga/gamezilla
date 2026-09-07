import { ChessBoard } from '@pkgs/chess-board/chess-board';
import { Box, Text } from '@pkgs/ui';
import type { JSX } from 'solid-js';

const SAMPLE_FEN =
  'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';

export default function ChessBoardExample(): JSX.Element {
  return (
    <Box sx={{ gap: 3, alignItems: 'stretch', width: '100%', maxWidth: 360 }}>
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label="Interactive Solid chess board."
      />
      <ChessBoard
        fen={SAMPLE_FEN}
        size={280}
        interactive
        showCoordinates
        highlightLastMove
      />
    </Box>
  );
}
