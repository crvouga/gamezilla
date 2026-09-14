/**
 * Default board palette per app color scheme and the merge rule for the
 * `theme` prop. Pure: no Solid, no DOM.
 */

import type {
  BoardArrowPalette,
  BoardPromotionPalette,
  BoardTheme,
  CellFeedbackKind,
} from '@pkgs/chess-board-core/types';

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

/** Chess.com-adjacent cream / olive board; last-move olive wash. */
export function defaultBoardTheme(scheme: BoardColorScheme): BoardTheme {
  const lightSquare = '#f0d9b5';
  const darkSquare = '#b58863';
  return {
    lightSquare,
    darkSquare,
    border: '#7a6248',
    lastMove: '#cdd26a',
    selected: '#f6eb79',
    legalMoveDot: 'rgba(26, 90, 36, 0.42)',
    legalMoveCaptureRing: 'rgba(26, 90, 36, 0.72)',
    check: '#e45c5c',
    coordinates: scheme === 'dark' ? '#f0e0c4' : '#4a3220',
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

/** Host CSS custom properties for square / overlay / chrome colors. */
export function boardThemeToCssVars(theme: BoardTheme): Record<string, string> {
  return {
    '--chess-sq-light': theme.lightSquare,
    '--chess-sq-dark': theme.darkSquare,
    '--chess-border': theme.border,
    '--chess-last-move': theme.lastMove,
    '--chess-selected': theme.selected,
    '--chess-check': theme.check,
    '--chess-legal-dot': theme.legalMoveDot,
    '--chess-legal-ring': theme.legalMoveCaptureRing,
    '--chess-coords': theme.coordinates,
    '--chess-feedback-check': theme.feedback.check,
    '--chess-feedback-cross': theme.feedback.cross,
    '--chess-feedback-exclamation': theme.feedback.exclamation,
    '--chess-feedback-double-exclam': theme.feedback.doubleExclam,
    '--chess-feedback-question': theme.feedback.question,
    '--chess-feedback-question-exclam': theme.feedback.questionExclam,
    '--chess-feedback-dot': theme.feedback.dot,
    '--chess-arrow-primary': theme.arrows.primary,
    '--chess-arrow-secondary': theme.arrows.secondary,
    '--chess-arrow-alt': theme.arrows.alt,
    '--chess-arrow-danger': theme.arrows.danger,
    '--chess-arrow-muted': theme.arrows.muted,
  };
}
