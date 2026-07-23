import { Box } from '@pkgs/ui';
import { useCallback, useState, type ReactNode } from 'react';
import type { LayoutChangeEvent } from 'react-native';

function squareFitSize(
  width: number,
  height: number,
  reserveTop: number
): number {
  return Math.floor(Math.min(width, Math.max(0, height - reserveTop)));
}

export type ChessPuzzleBoardFrameProps = {
  children: (size: number) => ReactNode;
  /** Optional overlays (celebration scrim, etc.) pinned to the square slot. */
  overlay?: ReactNode;
  /** Slim chrome stacked immediately above the square board (same width). */
  topAccessory?: ReactNode;
  /** Height reserved for `topAccessory` when fitting the square. */
  topAccessoryHeight?: number;
};

/**
 * Fits a 1:1 chess board slot inside the remaining viewport height. Uses full
 * container width until the square height would exceed the allotted space,
 * then shrinks width to preserve aspect ratio.
 */
export function ChessPuzzleBoardFrame({
  children,
  overlay,
  topAccessory,
  topAccessoryHeight = 0,
}: ChessPuzzleBoardFrameProps): ReactNode {
  const [size, setSize] = useState(0);
  const reserveTop = topAccessory !== undefined ? topAccessoryHeight : 0;

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      const next = squareFitSize(width, height, reserveTop);
      if (next > 0) {
        setSize((prev) => (prev === next ? prev : next));
      }
    },
    [reserveTop]
  );

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        alignSelf: 'stretch',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onLayout={onLayout}
    >
      {size > 0 ? (
        <Box style={{ width: size }}>
          {topAccessory}
          <Box style={{ width: size, height: size, position: 'relative' }}>
            {children(size)}
            {overlay}
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}
