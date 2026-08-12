import { assert } from '@pkgs/assert';
import { Box, useTheme } from '@pkgs/ui';
import { assertSkiaWebLoaded } from '@pkgs/ui/components/skia-web-root';
import { memo, type ReactNode, useCallback, useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import type { ChessBoardCanvasProps } from './chess-board-canvas';
import { useChessBoardCanvas } from './chess-board-canvas-runtime';
import type {
  BoardArrowPalette,
  BoardPromotionPalette,
  BoardTheme,
  CellFeedbackKind,
  ChessBoardProps,
} from './chess-board-types';

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

/**
 * Promotion chrome sits on the board, so it follows square colors — never the
 * app color scheme (dark app + dark surface makes black pieces unreadable).
 */
function defaultPromotionPalette(squares: {
  lightSquare: string;
  darkSquare: string;
}): BoardPromotionPalette {
  return {
    backdrop: 'rgba(20,20,26,0.45)',
    surface: squares.lightSquare,
    surfaceActive: squares.lightSquare,
    cancel: squares.darkSquare,
    ink: squares.lightSquare,
  };
}

function defaultBoardTheme(theme: ReturnType<typeof useTheme>): BoardTheme {
  const lightSquare = '#f0d9b5';
  const darkSquare = '#b58863';
  return {
    lightSquare,
    darkSquare,
    border: '#8a6a3d',
    lastMove: '#cdd26a',
    selected: '#f7ec74',
    legalMoveDot: 'rgba(20,85,30,0.5)' as const,
    legalMoveCaptureRing: 'rgba(20,85,30,0.75)' as const,
    check: '#d64545',
    coordinates: theme.colorScheme === 'dark' ? '#e8d6b4' : '#5a3b1c',
    feedback: defaultFeedbackPalette(theme.colorScheme),
    arrows: defaultArrowPalette(theme.colorScheme),
    promotion: defaultPromotionPalette({ lightSquare, darkSquare }),
  };
}

function mergeBoardTheme(
  base: BoardTheme,
  override: Partial<BoardTheme> | undefined
): BoardTheme {
  if (!override) return base;
  const lightSquare = override.lightSquare ?? base.lightSquare;
  const darkSquare = override.darkSquare ?? base.darkSquare;
  const derivedPromotion = defaultPromotionPalette({ lightSquare, darkSquare });
  return {
    ...base,
    ...override,
    lightSquare,
    darkSquare,
    feedback: { ...base.feedback, ...(override.feedback ?? {}) },
    arrows: { ...base.arrows, ...(override.arrows ?? {}) },
    promotion: { ...derivedPromotion, ...(override.promotion ?? {}) },
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
    animations = true,
    cellFeedback,
    cellHighlights,
    arrows,
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
      enableUserArrows,
      animations,
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
      animations,
      cellFeedback,
      cellHighlights,
      arrows,
      enableUserArrows,
      onUserArrowsChange,
      theme,
    ]
  );
}

/**
 * Stable styles for the outer measured/explicit-size shells. Module-level
 * constants so React.memo on the wrapped board can shallow-compare.
 */
const MEASURED_STYLE = {
  width: '100%' as const,
  aspectRatio: 1,
  overflow: 'visible' as const,
};

function explicitSizeStyle(size: number) {
  return { width: size, height: size, overflow: 'visible' as const };
}

function ChessBoardImpl(props: ChessBoardProps): ReactNode {
  assertSkiaWebLoaded();

  const { size, testID, theme: themeOverride } = props;

  const appTheme = useTheme();
  const theme = useMemo(
    () => mergeBoardTheme(defaultBoardTheme(appTheme), themeOverride),
    [appTheme, themeOverride]
  );

  const [measured, setMeasured] = useState<number | null>(null);
  const boardSize = size ?? measured ?? 0;

  // `setMeasured`'s closure captures `measured` per render; wrapping in
  // `useCallback([measured, size])` is fine — the dep set is tiny, and the
  // alternative (functional updater) would still allocate a new closure
  // every render under React's strict-mode double-invoke.
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      if (size !== undefined) return;
      const w = e.nativeEvent.layout.width;
      const next = Math.floor(w);
      if (next > 0 && next !== measured) setMeasured(next);
    },
    [measured, size]
  );

  const canvasProps = useChessBoardCanvasProps(props, boardSize, theme);

  /**
   * Canvas component is loaded ONCE inside `ChessBoardCanvasBootstrap`
   * (mounted at `ChessMainMenu`, the chess subtree root) and published to
   * the runtime singleton. The bootstrap's Suspense BLOCKS the chess
   * subtree until the chunk has resolved, so by the time any `ChessBoard`
   * mounts the singleton is guaranteed non-null — `assert.defined` here
   * documents that invariant and lets the JSX use the component directly
   * without a fallback branch (which would otherwise risk a layout swap).
   *
   * `aspectRatio: 1` reserves the square slot BEFORE first layout has
   * been measured, so the canvas never shifts the rest of the screen.
   *
   * The `react-hooks/static-components` lint disable below is intentional:
   * the singleton publishes a module-level component reference exactly once
   * and never reassigns, so React's reconciler sees the same component type
   * on every render — no unmount/remount, no state loss. Reading it through
   * a hook is what gives the chess subtree its one-time subscription.
   */
  const ChessBoardCanvas = useChessBoardCanvas();
  assert.defined(ChessBoardCanvas, 'ChessBoardCanvas must be defined');

  // Gate the canvas until we have a real measured size. Skipping this
  // mount-step is the single most important fix for the "pieces jump
  // from top-left" mount flash: `ChessBoardPieceSkia` seeds its
  // `useSharedValue` with `targetCenterX/Y - pieceSize/2`. If we render
  // it once with `size=0` those shared values lock onto `(0,0)`, and the
  // next render snaps them to the real target. By only mounting the
  // canvas after `onLayout` has produced a non-zero width, the shared
  // values are seeded at the correct target on the very first frame.
  // Total cost: at most one extra frame on first mount
  // (`<Box aspectRatio=1>` measures synchronously after first commit).
  const canvasReady = boardSize > 0;

  return (
    <Box
      testID={testID}
      onLayout={onLayout}
      sx={[
        { alignSelf: 'center' },
        size !== undefined ? explicitSizeStyle(size) : MEASURED_STYLE,
      ]}
    >
      {canvasReady ? (
        // see hook call above
        <ChessBoardCanvas {...canvasProps} />
      ) : null}
    </Box>
  );
}

export const ChessBoard = memo(ChessBoardImpl);
