import { Box } from '@gamezilla/ui';
import type { ReactNode } from 'react';

/**
 * Reserves the exact square the {@link ChessBoard} would occupy while a new
 * puzzle's FEN is being fetched. Avoids the one-frame "standard startpos"
 * flash that used to occur when the board mounted with an empty `fen` and
 * `useChessGame` fell back to `new Chess()`.
 */
export function ChessPuzzleBoardSkeleton(): ReactNode {
  return (
    <Box
      sx={{ alignSelf: 'center', background: 'surface' }}
      style={{ width: '100%', aspectRatio: 1, opacity: 0.5 }}
    />
  );
}
