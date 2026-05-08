/* eslint-disable max-lines-per-function */
import { WithSkiaWeb } from '@gamezilla/client/ui/with-skia-web';
import { Box, useTheme } from '@gamezilla/lib/ui';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import type { ChessBoardCanvasProps } from './chess-board-canvas';
import type { BoardTheme, ChessBoardProps } from './chess-board-types';

function defaultBoardTheme(theme: ReturnType<typeof useTheme>): BoardTheme {
  return {
    lightSquare: '#f0d9b5',
    darkSquare: '#b58863',
    border: '#8a6a3d',
    lastMove: '#cdd26a',
    selected: '#f7ec74',
    legalMoveDot: 'rgba(20,85,30,0.5)',
    check: '#d64545',
    coordinates:
      theme.colorScheme === 'dark' ? '#e8d6b4' : '#5a3b1c',
  };
}

export function ChessBoard(props: ChessBoardProps): ReactNode {
  const {
    fen,
    onMove,
    orientation = 'white',
    size,
    interactive = true,
    showCoordinates = true,
    highlightLastMove = true,
    highlightLegalMoves = true,
    theme: themeOverride,
    testID,
  } = props;

  const appTheme = useTheme();
  const theme = useMemo(() => {
    const base = defaultBoardTheme(appTheme);
    return { ...base, ...(themeOverride ?? {}) };
  }, [appTheme, themeOverride]);

  const [measured, setMeasured] = useState<number | null>(null);
  const boardSize = size ?? measured ?? 0;

  const onLayout = (e: LayoutChangeEvent) => {
    if (size !== undefined) return;
    // The board is always square. Measure from width only — the wrapper has no
    // intrinsic height before the canvas mounts, so using `min(w, h)` would
    // deadlock at 0 (canvas only renders when `boardSize > 0`).
    const w = e.nativeEvent.layout.width;
    const next = Math.floor(w);
    if (next > 0 && next !== measured) setMeasured(next);
  };

  const componentProps = useMemo<ChessBoardCanvasProps>(
    () => ({
      ...(fen !== undefined ? { fen } : {}),
      ...(onMove !== undefined ? { onMove } : {}),
      orientation,
      size: boardSize,
      interactive,
      showCoordinates,
      highlightLastMove,
      highlightLegalMoves,
      theme,
    }),
    [
      fen,
      onMove,
      orientation,
      boardSize,
      interactive,
      showCoordinates,
      highlightLastMove,
      highlightLegalMoves,
      theme,
    ]
  );

  // Dynamic import keeps `chess-board-canvas` (and its
  // `import { Skia } from '@shopify/react-native-skia'`) out of the eager
  // module graph on web. Shopify's `WithSkiaWeb` awaits `LoadSkiaWeb()`
  // before invoking this, so `global.CanvasKit` is set before any factory
  // closures inside `Skia` capture it.
  const getComponent = useCallback(
    () =>
      import('./chess-board-canvas').then((m) => ({
        default: m.ChessBoardCanvas,
      })),
    []
  );

  return (
    <Box
      testID={testID}
      onLayout={onLayout}
      sx={{ alignSelf: 'center' }}
      style={
        size !== undefined
          ? { width: size, height: size, overflow: 'visible' }
          : { width: '100%', overflow: 'visible' }
      }
    >
      {boardSize > 0 ? (
        <WithSkiaWeb<ChessBoardCanvasProps>
          getComponent={getComponent}
          componentProps={componentProps}
        />
      ) : null}
    </Box>
  );
}
