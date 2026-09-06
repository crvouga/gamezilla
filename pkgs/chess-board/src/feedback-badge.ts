/**
 * Cell-feedback badge geometry in board units (100 per cell). Pure helpers
 * shared by the SVG feedback layer and its tests.
 */

import type {
  CellFeedback,
  CellFeedbackCorner,
  CellFeedbackKind,
  Square,
} from '@pkgs/chess-board-core/types';
import { CELL_UNITS, squareOrigin } from './board-units';
import type { BoardOrientation } from './chess-board-types';

/** Vector glyph paths authored in a 100×100 box; scaled into the badge. */
export const GLYPH_PATHS_100: Partial<Record<CellFeedbackKind, string>> = {
  check: 'M18 54 L42 78 L84 26',
  cross: 'M22 22 L78 78 M78 22 L22 78',
  star: 'M50 10 L61 38 L92 40 L67 60 L75 90 L50 73 L25 90 L33 60 L8 40 L39 38 Z',
  crown: 'M14 30 L28 56 L42 22 L58 22 L72 56 L86 30 L82 80 L18 80 Z',
  dot: 'M50 50 m-26 0 a26 26 0 1 0 52 0 a26 26 0 1 0 -52 0',
};

export const TEXT_GLYPH: Partial<Record<CellFeedbackKind, string>> = {
  exclamation: '!',
  doubleExclam: '!!',
  question: '?',
  questionExclam: '?!',
};

export const BADGE_RADIUS = Math.max(8, CELL_UNITS * 0.16);
export const BADGE_RING_WIDTH = Math.max(1.5, CELL_UNITS * 0.025);
export const BADGE_FONT_SIZE = Math.max(10, Math.floor(CELL_UNITS * 0.28));

export type FeedbackBadge = {
  readonly square: Square;
  readonly feedback: CellFeedback;
  readonly cx: number;
  readonly cy: number;
};

export function badgeCenter(
  square: Square,
  corner: CellFeedbackCorner,
  orientation: BoardOrientation
): { cx: number; cy: number } {
  const { x, y } = squareOrigin(square, orientation);
  const inset = BADGE_RADIUS + CELL_UNITS * 0.04;
  switch (corner) {
    case 'topLeft':
      return { cx: x + inset, cy: y + inset };
    case 'topRight':
      return { cx: x + CELL_UNITS - inset, cy: y + inset };
    case 'bottomLeft':
      return { cx: x + inset, cy: y + CELL_UNITS - inset };
    case 'bottomRight':
      return { cx: x + CELL_UNITS - inset, cy: y + CELL_UNITS - inset };
    case 'center':
      return { cx: x + CELL_UNITS / 2, cy: y + CELL_UNITS / 2 };
  }
}

export function glyphStyle(kind: CellFeedbackKind): 'stroke' | 'fill' {
  return kind === 'check' || kind === 'cross' ? 'stroke' : 'fill';
}

export function feedbackBadges(
  cellFeedback: Partial<Record<Square, CellFeedback>> | undefined,
  orientation: BoardOrientation
): readonly FeedbackBadge[] {
  if (cellFeedback === undefined) return [];
  const out: FeedbackBadge[] = [];
  for (const [square, feedback] of Object.entries(cellFeedback) as [
    Square,
    CellFeedback | undefined,
  ][]) {
    if (feedback === undefined) continue;
    const { cx, cy } = badgeCenter(
      square,
      feedback.corner ?? 'topRight',
      orientation
    );
    out.push({ square, feedback, cx, cy });
  }
  return out;
}
