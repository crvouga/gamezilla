import { Box, Spinner } from '@pkgs/ui';
import type { ReactNode } from 'react';

/**
 * Reserves the exact square the {@link ChessBoard} would occupy while a new
 * puzzle's FEN is being fetched. Centers a spinner so loading reads clearly
 * without changing the board slot footprint.
 */
export type ChessPuzzleBoardLoadingStateProps = {
  size?: number;
};

export function ChessPuzzleBoardLoadingState({
  size,
}: ChessPuzzleBoardLoadingStateProps = {}): ReactNode {
  const dimensionStyle =
    size !== undefined
      ? { width: size, height: size }
      : { width: '100%' as const, aspectRatio: 1 };
  return (
    <Box
      sx={{
        alignSelf: 'center',
        background: 'surface',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      style={dimensionStyle}
    >
      <Spinner size="large" />
    </Box>
  );
}
