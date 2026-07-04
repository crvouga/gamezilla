import { Box, Spinner } from '@pkgs/ui';
import type { ReactNode } from 'react';

/**
 * Reserves the exact square the {@link ChessBoard} would occupy while a new
 * puzzle's FEN is being fetched. Centers a spinner so loading reads clearly
 * without changing the board slot footprint.
 */
export function ChessPuzzleBoardLoadingState(): ReactNode {
  return (
    <Box
      sx={{
        alignSelf: 'center',
        background: 'surface',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      style={{ width: '100%', aspectRatio: 1 }}
    >
      <Spinner size="large" />
    </Box>
  );
}
