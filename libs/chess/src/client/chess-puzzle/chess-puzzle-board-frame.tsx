import { Box } from '@pkgs/ui';
import { useCallback, useState, type ReactNode } from 'react';
import type { LayoutChangeEvent } from 'react-native';

function squareFitSize(width: number, height: number): number {
  return Math.floor(Math.min(width, height));
}

export type ChessPuzzleBoardFrameProps = {
  children: (size: number) => ReactNode;
  /** Optional overlays (celebration scrim, etc.) pinned to the square slot. */
  overlay?: ReactNode;
};

/**
 * Fits a 1:1 chess board slot inside the remaining viewport height. Uses full
 * container width until the square height would exceed the allotted space,
 * then shrinks width to preserve aspect ratio.
 */
export function ChessPuzzleBoardFrame({
  children,
  overlay,
}: ChessPuzzleBoardFrameProps): ReactNode {
  const [size, setSize] = useState(0);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const next = squareFitSize(width, height);
    if (next > 0) {
      setSize((prev) => (prev === next ? prev : next));
    }
  }, []);

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
        <Box style={{ width: size, height: size, position: 'relative' }}>
          {children(size)}
          {overlay}
        </Box>
      ) : null}
    </Box>
  );
}
