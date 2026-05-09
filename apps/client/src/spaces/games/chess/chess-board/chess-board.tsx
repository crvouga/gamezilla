import { assertSkiaWebLoaded } from '@gamezilla/client/ui/skia-web-root';
import { Box, useTheme } from '@gamezilla/lib/ui';
import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import type { ChessBoardCanvasProps } from './chess-board-canvas';
import type { BoardTheme, ChessBoardProps } from './chess-board-types';

/**
 * Canvas must load only after CanvasKit exists; a static import can run too
 * early (prefetch / chunk order) and `Skia = JsiSkApi(global.CanvasKit)` captures
 * `undefined` forever.
 */
const ChessBoardCanvasLazy = lazy(async () => {
  assertSkiaWebLoaded();
  const m = await import('./chess-board-canvas');
  return { default: m.ChessBoardCanvas };
});

function defaultBoardTheme(theme: ReturnType<typeof useTheme>): BoardTheme {
  return {
    lightSquare: '#f0d9b5',
    darkSquare: '#b58863',
    border: '#8a6a3d',
    lastMove: '#cdd26a',
    selected: '#f7ec74',
    legalMoveDot: 'rgba(20,85,30,0.5)' as const,
    legalMoveCaptureRing: 'rgba(20,85,30,0.75)' as const,
    check: '#d64545',
    coordinates: theme.colorScheme === 'dark' ? '#e8d6b4' : '#5a3b1c',
  };
}

export function ChessBoard(props: ChessBoardProps): ReactNode {
  assertSkiaWebLoaded();

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
    const w = e.nativeEvent.layout.width;
    const next = Math.floor(w);
    if (next > 0 && next !== measured) setMeasured(next);
  };

  const canvasProps = useMemo<ChessBoardCanvasProps>(
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
      <Suspense fallback={null}>
        <ChessBoardCanvasLazy {...canvasProps} />
      </Suspense>
    </Box>
  );
}
