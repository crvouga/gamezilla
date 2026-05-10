/* eslint-disable lingui/no-unlocalized-strings */
import { assertSkiaWebLoaded } from '@gamezilla/client/ui/skia-web-root';
import { Box, useTheme } from '@gamezilla/ui';
import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import type { ChessBoardCanvasProps } from './chess-board-canvas';
import type {
  BoardArrowPalette,
  BoardPromotionPalette,
  BoardTheme,
  CellFeedbackKind,
  ChessBoardProps,
} from './chess-board-types';

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

function defaultFeedbackPalette(
  scheme: 'light' | 'dark'
): Record<CellFeedbackKind, string> {
  if (scheme === 'dark') {
    return {
      check: '#3ad07a',
      cross: '#f06464',
      exclamation: '#ffa83a',
      doubleExclam: '#3a8cff',
      question: '#c882ff',
      questionExclam: '#ffd64a',
      star: '#ffd64a',
      crown: '#ffd64a',
      dot: '#cfd2db',
    };
  }
  return {
    check: '#1f9d4a',
    cross: '#d63a3a',
    exclamation: '#e2730a',
    doubleExclam: '#1565d8',
    question: '#7e3ad0',
    questionExclam: '#caa30a',
    star: '#d4a017',
    crown: '#b8860b',
    dot: '#3a3d4a',
  };
}

function defaultArrowPalette(scheme: 'light' | 'dark'): BoardArrowPalette {
  if (scheme === 'dark') {
    return {
      primary: '#3ad07a',
      secondary: '#3a8cff',
      alt: '#ffd64a',
      danger: '#f06464',
      muted: '#bdbecf',
    };
  }
  return {
    primary: '#1f9d4a',
    secondary: '#1565d8',
    alt: '#caa30a',
    danger: '#d63a3a',
    muted: '#646778',
  };
}

function defaultPromotionPalette(
  scheme: 'light' | 'dark'
): BoardPromotionPalette {
  if (scheme === 'dark') {
    return {
      backdrop: 'rgba(8,10,14,0.55)',
      surface: '#1f2128',
      surfaceActive: '#2c2f39',
      cancel: '#3a3d4a',
    };
  }
  return {
    backdrop: 'rgba(20,20,26,0.45)',
    surface: '#ffffff',
    surfaceActive: '#f1efe7',
    cancel: '#dad6ca',
  };
}

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
    feedback: defaultFeedbackPalette(theme.colorScheme),
    arrows: defaultArrowPalette(theme.colorScheme),
    promotion: defaultPromotionPalette(theme.colorScheme),
  };
}

function mergeBoardTheme(
  base: BoardTheme,
  override: Partial<BoardTheme> | undefined
): BoardTheme {
  if (!override) return base;
  return {
    ...base,
    ...override,
    feedback: { ...base.feedback, ...(override.feedback ?? {}) },
    arrows: { ...base.arrows, ...(override.arrows ?? {}) },
    promotion: { ...base.promotion, ...(override.promotion ?? {}) },
  };
}

function useChessBoardCanvasProps(
  props: ChessBoardProps,
  boardSize: number,
  theme: BoardTheme
): ChessBoardCanvasProps {
  const {
    fen,
    controlled = false,
    fenSyncKey,
    onMove,
    orientation = 'white',
    interactive = true,
    showCoordinates = true,
    highlightLastMove = true,
    highlightLegalMoves = true,
    cellFeedback,
    cellHighlights,
    arrows,
    promotionStyle = 'inline',
    dragOverlayPortal = true,
    enableUserArrows = false,
    onUserArrowsChange,
  } = props;

  return useMemo(
    () => ({
      ...(fen !== undefined ? { fen } : {}),
      ...(onMove !== undefined ? { onMove } : {}),
      ...(controlled ? { controlled: true } : {}),
      ...(fenSyncKey !== undefined ? { fenSyncKey } : {}),
      ...(cellFeedback !== undefined ? { cellFeedback } : {}),
      ...(cellHighlights !== undefined ? { cellHighlights } : {}),
      ...(arrows !== undefined ? { arrows } : {}),
      ...(onUserArrowsChange !== undefined ? { onUserArrowsChange } : {}),
      orientation,
      size: boardSize,
      interactive,
      showCoordinates,
      highlightLastMove,
      highlightLegalMoves,
      promotionStyle,
      dragOverlayPortal,
      enableUserArrows,
      theme,
    }),
    [
      fen,
      controlled,
      fenSyncKey,
      onMove,
      orientation,
      boardSize,
      interactive,
      showCoordinates,
      highlightLastMove,
      highlightLegalMoves,
      cellFeedback,
      cellHighlights,
      arrows,
      promotionStyle,
      dragOverlayPortal,
      enableUserArrows,
      onUserArrowsChange,
      theme,
    ]
  );
}

export function ChessBoard(props: ChessBoardProps): ReactNode {
  assertSkiaWebLoaded();

  const { size, testID, theme: themeOverride } = props;

  const appTheme = useTheme();
  const theme = useMemo(
    () => mergeBoardTheme(defaultBoardTheme(appTheme), themeOverride),
    [appTheme, themeOverride]
  );

  const [measured, setMeasured] = useState<number | null>(null);
  const boardSize = size ?? measured ?? 0;

  const onLayout = (e: LayoutChangeEvent) => {
    if (size !== undefined) return;
    const w = e.nativeEvent.layout.width;
    const next = Math.floor(w);
    if (next > 0 && next !== measured) setMeasured(next);
  };

  const canvasProps = useChessBoardCanvasProps(props, boardSize, theme);

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
