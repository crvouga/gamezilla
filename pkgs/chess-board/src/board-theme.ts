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

export function defaultBoardTheme(scheme: BoardColorScheme): BoardTheme {
  const lightSquare = '#f0d9b5';
  const darkSquare = '#b58863';
  return {
    lightSquare,
    darkSquare,
    border: '#8a6a3d',
    lastMove: '#cdd26a',
    selected: '#f7ec74',
    legalMoveDot: 'rgba(20,85,30,0.5)',
    legalMoveCaptureRing: 'rgba(20,85,30,0.75)',
    check: '#d64545',
    coordinates: scheme === 'dark' ? '#e8d6b4' : '#5a3b1c',
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
