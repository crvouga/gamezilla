/**
 * Renderer-agnostic arrow geometry for board annotations. Produces polylines
 * (shaft) and a triangle (head) in board pixels; renderers turn them into
 * SVG `d` strings ({@link arrowSvgPaths}) or canvas paths.
 */

import { isKnightJump, squareCenter } from './geometry';
import type { BoardArrow, BoardOrientation, Square } from './types';

export type Point = { readonly x: number; readonly y: number };

export type ArrowGeometry = {
  /** Polyline from the origin center to the head base (2 or 3 points). */
  readonly shaft: readonly Point[];
  /** Triangle: tip, then the two base corners. */
  readonly head: readonly [Point, Point, Point];
  /** Stroke width in board pixels. */
  readonly thickness: number;
};

export const ARROW_DEFAULT_THICKNESS_FRACTION = 0.14;
export const ARROW_DEFAULT_OPACITY = 0.85;
const ARROW_MIN_THICKNESS_PX = 3;

/** Stroke width in pixels from a cell size and a fraction-of-cell thickness. */
export function arrowThicknessPx(cellPx: number, fraction?: number): number {
  return Math.max(
    ARROW_MIN_THICKNESS_PX,
    cellPx * (fraction ?? ARROW_DEFAULT_THICKNESS_FRACTION)
  );
}

function headDimensions(thickness: number): {
  headLen: number;
  headHalfWidth: number;
} {
  return {
    headLen: Math.max(thickness * 2.4, 14),
    headHalfWidth: Math.max(thickness * 1.6, 9),
  };
}

/** Knight elbow: travel along the longer leg first (lichess convention). */
export function knightCorner(a: Point, b: Point): Point {
  const verticalLeg = Math.abs(a.y - b.y) > Math.abs(a.x - b.x);
  return verticalLeg ? { x: a.x, y: b.y } : { x: b.x, y: a.y };
}

function arrowHead(
  from: Point,
  to: Point,
  thickness: number
): { base: Point; head: [Point, Point, Point] } {
  const { headLen, headHalfWidth } = headDimensions(thickness);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / len;
  const uy = dy / len;
  const base = { x: to.x - ux * headLen, y: to.y - uy * headLen };
  const perpX = -uy;
  const perpY = ux;
  return {
    base,
    head: [
      to,
      { x: base.x + perpX * headHalfWidth, y: base.y + perpY * headHalfWidth },
      { x: base.x - perpX * headHalfWidth, y: base.y - perpY * headHalfWidth },
    ],
  };
}

/**
 * Shaft + head for `from → to`. The shaft stops at the head base so the
 * tip sits flush with the destination center. Knight jumps bend into an L.
 */
export function arrowGeometry(args: {
  from: Square;
  to: Square;
  boardPx: number;
  orientation: BoardOrientation;
  thickness: number;
  knight?: boolean | undefined;
}): ArrowGeometry {
  const { from, to, boardPx, orientation, thickness } = args;
  const a = squareCenter(from, boardPx, orientation);
  const b = squareCenter(to, boardPx, orientation);
  const knight = args.knight ?? isKnightJump(from, to);
  if (knight) {
    const corner = knightCorner(a, b);
    const { base, head } = arrowHead(corner, b, thickness);
    return { shaft: [a, corner, base], head, thickness };
  }
  const { base, head } = arrowHead(a, b, thickness);
  return { shaft: [a, base], head, thickness };
}

/** Geometry for a {@link BoardArrow} using its own thickness / knight hints. */
export function boardArrowGeometry(
  arrow: BoardArrow,
  boardPx: number,
  orientation: BoardOrientation
): ArrowGeometry {
  return arrowGeometry({
    from: arrow.from,
    to: arrow.to,
    boardPx,
    orientation,
    thickness: arrowThicknessPx(boardPx / 8, arrow.thickness),
    knight: arrow.knight,
  });
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/** SVG path `d` strings: open polyline for the shaft, closed triangle for the head. */
export function arrowSvgPaths(g: ArrowGeometry): {
  shaftD: string;
  headD: string;
} {
  const shaftD = g.shaft
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${fmt(p.x)} ${fmt(p.y)}`)
    .join(' ');
  const [tip, l, r] = g.head;
  const headD = `M${fmt(tip.x)} ${fmt(tip.y)} L${fmt(l.x)} ${fmt(l.y)} L${fmt(r.x)} ${fmt(r.y)} Z`;
  return { shaftD, headD };
}

/** Dash pattern matching the RN board (`[1.6t, 1.2t]`). */
export function arrowDashArray(thickness: number): readonly [number, number] {
  return [thickness * 1.6, thickness * 1.2];
}
