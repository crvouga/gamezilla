/**
 * User / external board shapes (arrows + circles) and brush selection from
 * modifier keys (lichess / chessground-style).
 */

import type { Square } from './types';

export type BoardShape =
  | {
      kind: 'arrow';
      from: Square;
      to: Square;
      color: string;
      knight?: boolean;
      id?: string;
    }
  | { kind: 'circle'; square: Square; color: string; id?: string };

export type ShapeBrush = 'primary' | 'secondary' | 'alt' | 'danger';

/**
 * Modifier → brush (chessground-adjacent): default green, Shift red, Alt blue,
 * Ctrl/Meta yellow.
 */
export function brushFromModifiers(
  shift: boolean,
  alt: boolean,
  ctrl: boolean
): ShapeBrush {
  if (ctrl) return 'alt';
  if (alt) return 'secondary';
  if (shift) return 'danger';
  return 'primary';
}

function shapeKey(shape: BoardShape): string {
  if (shape.kind === 'arrow') {
    return `arrow:${shape.from}:${shape.to}:${shape.knight === true ? 1 : 0}`;
  }
  return `circle:${shape.square}`;
}

/**
 * Toggle geometry: same key + same color removes; same key + new color
 * replaces; otherwise appends.
 */
export function toggleShape(
  shapes: readonly BoardShape[],
  next: BoardShape
): BoardShape[] {
  const key = shapeKey(next);
  const idx = shapes.findIndex((s) => shapeKey(s) === key);
  if (idx < 0) return [...shapes, next];
  const existing = shapes[idx]!;
  if (existing.color === next.color) {
    return shapes.filter((_, i) => i !== idx);
  }
  const out = shapes.slice();
  out[idx] = next;
  return out;
}
