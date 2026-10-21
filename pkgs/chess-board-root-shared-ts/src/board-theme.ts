/**
 * Default board palette per app color scheme and the merge rule for the
 * `theme` prop. Pure: no Solid, no DOM.
 */

import type {
  BoardArrowPalette,
  BoardPromotionPalette,
  BoardTheme,
  CellFeedbackKind,
} from '@pkgs/chess-board-core-shared-ts/types';

export type BoardColorScheme = 'light' | 'dark';

function defaultFeedbackPalette(
  scheme: BoardColorScheme
): Record<CellFeedbackKind, string> {
  if (scheme === 'dark') {
    return {
      check: '#3ad07a',
      cross: '#f06464',
      exclamation: '#ffa83a',
      doubleExclam: '#3a8cff',
      question: '#c882ff',
      questionExclam: '#ffd64a',
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
    dot: '#3a3d4a',
  };
}

function defaultArrowPalette(scheme: BoardColorScheme): BoardArrowPalette {
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

/**
 * Cream / brown board. Square washes are translucent (chess.com-style) so a
 * highlighted square keeps its light / dark tone; coordinates take the
 * opposite square color.
 */
export function defaultBoardTheme(scheme: BoardColorScheme): BoardTheme {
  const lightSquare = '#f0d9b5';
  const darkSquare = '#b58863';
  return {
    lightSquare,
    darkSquare,
    border: '#7a6248',
    lastMove: 'rgba(255, 255, 51, 0.5)',
    selected: 'rgba(255, 255, 51, 0.5)',
    premove: 'rgba(244, 42, 50, 0.55)',
    hover: 'rgba(255, 255, 255, 0.65)',
    legalMoveDot: 'rgba(0, 0, 0, 0.14)',
    legalMoveCaptureRing: 'rgba(0, 0, 0, 0.14)',
    check: 'rgba(255, 0, 0, 0.9)',
    feedback: defaultFeedbackPalette(scheme),
    arrows: defaultArrowPalette(scheme),
    promotion: defaultPromotionPalette({ lightSquare, darkSquare }),
  };
}

export function mergeBoardTheme(
  base: BoardTheme,
  override: Partial<BoardTheme> | undefined
): BoardTheme {
  if (override === undefined) return base;
  const lightSquare = override.lightSquare ?? base.lightSquare;
  const darkSquare = override.darkSquare ?? base.darkSquare;
  const derivedPromotion = defaultPromotionPalette({ lightSquare, darkSquare });
  return {
    ...base,
    ...override,
    lightSquare,
    darkSquare,
    feedback: { ...base.feedback, ...override.feedback },
    arrows: { ...base.arrows, ...override.arrows },
    promotion: { ...derivedPromotion, ...override.promotion },
  };
}

/**
 * Host CSS custom properties — only the ones the stylesheet reads (badge and
 * arrow colours are SVG attributes, not variables).
 */
export function boardThemeToCssVars(theme: BoardTheme): Record<string, string> {
  return {
    '--chess-sq-light': theme.lightSquare,
    '--chess-sq-dark': theme.darkSquare,
    '--chess-border': theme.border,
    '--chess-last-move': theme.lastMove,
    '--chess-selected': theme.selected,
    '--chess-premove': theme.premove,
    '--chess-hover': theme.hover,
    '--chess-check': theme.check,
    '--chess-legal-dot': theme.legalMoveDot,
    '--chess-legal-ring': theme.legalMoveCaptureRing,
  };
}
