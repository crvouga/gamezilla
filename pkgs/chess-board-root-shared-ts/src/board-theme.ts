import type {
  BoardPromotionPalette,
  BoardTheme,
} from '@pkgs/chess-board-core-shared-ts/types';
import { COLOR_PALETTE } from '@pkgs/ui-root-shared-ts/color-palette';
import {
  bestOnColor,
  contrastRatio,
  ON_DARK,
  ON_LIGHT,
  parseColor,
} from '@pkgs/ui-root-shared-ts/contrast';

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
    ink: bestOnColor(squares.darkSquare).fg,
  };
}

/** Board squares and interaction ink are shared by puzzles, matches and previews. */
export function defaultBoardTheme(): BoardTheme {
  const {
    boardLight: lightSquare,
    boardDark: darkSquare,
    boardHighlight,
  } = COLOR_PALETTE;
  return {
    lightSquare,
    darkSquare,
    border: COLOR_PALETTE.surfaceElevated,
    lastMove: boardHighlight,
    selected: `color-mix(in srgb, ${COLOR_PALETTE.reward} 75%, transparent)`,
    premove: 'rgba(244, 42, 50, 0.55)',
    hover: 'rgba(255, 255, 255, 0.65)',
    legalMoveDot: ON_LIGHT.icon,
    legalMoveCaptureRing: ON_LIGHT.icon,
    check: 'rgba(255, 0, 0, 0.9)',
    feedback: {
      check: COLOR_PALETTE.success,
      cross: COLOR_PALETTE.destructive,
      exclamation: COLOR_PALETTE.warning,
      doubleExclam: COLOR_PALETTE.info,
      question: COLOR_PALETTE.tint,
      questionExclam: COLOR_PALETTE.reward,
      dot: COLOR_PALETTE.textSecondary,
    },
    arrows: {
      primary: COLOR_PALETTE.success,
      secondary: COLOR_PALETTE.info,
      alt: COLOR_PALETTE.reward,
      danger: COLOR_PALETTE.destructive,
      muted: COLOR_PALETTE.textSecondary,
    },
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

/** `a` moved `amount` (0..1) of the way to `b`, both `#rrggbb`; `a` as given otherwise. */
function mixHex(a: string, b: string, amount: number): string {
  const parse = (hex: string) =>
    /^#[0-9a-f]{6}$/i.test(hex)
      ? [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16))
      : null;
  const from = parse(a);
  const to = parse(b);
  if (from === null || to === null) return a;
  return `#${from
    .map((channel, i) =>
      Math.round(channel + ((to[i] ?? channel) - channel) * amount)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`;
}

/** A tonal ink when it reads as normal text on `square`, else the best plain ink. */
function readableInk(tonal: string, square: string): string {
  const ink = parseColor(tonal);
  const surface = parseColor(square);
  return ink && surface && contrastRatio(ink, surface) >= 4.5
    ? tonal
    : bestOnColor(square).fg;
}

/** Coordinate labels derive from the actual squares, including custom boards. */
function coordinateInks(theme: BoardTheme): Record<string, string> {
  return {
    '--chess-coord-on-light': readableInk(
      mixHex(theme.border, '#000000', 0.32),
      theme.lightSquare
    ),
    '--chess-coord-on-dark': readableInk(
      mixHex(theme.lightSquare, '#ffffff', 0.7),
      theme.darkSquare
    ),
  };
}

/**
 * The focus ring's inner band: of the plain inks, the one whose weaker
 * contrast over the two squares is higher, so the ring reads on both.
 */
function focusBand(theme: BoardTheme): string {
  const light = parseColor(theme.lightSquare);
  const dark = parseColor(theme.darkSquare);
  const weakest = (ink: string): number => {
    const rgb = parseColor(ink);
    if (!rgb || !light || !dark) return 0;
    return Math.min(contrastRatio(rgb, light), contrastRatio(rgb, dark));
  };
  return weakest(ON_DARK.fg) > weakest(ON_LIGHT.fg) ? ON_DARK.fg : ON_LIGHT.fg;
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
    '--chess-focus-band': focusBand(theme),
    ...coordinateInks(theme),
  };
}
