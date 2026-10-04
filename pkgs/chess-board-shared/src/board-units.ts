/**
 * Two coordinate systems, neither of which needs a pixel measurement to
 * render:
 *
 * - HTML layers (pieces, square washes, hints) are one-cell boxes anchored
 *   top-left and placed from the board content width with `translate(col·12.5cqw, row·12.5cqw)`, so a resize
 *   never rewrites a transform and every slide is a compositor animation.
 * - SVG layers (arrows, circles, badges, coordinates) draw in a fixed
 *   user-unit space (`0 0 800 800`, 100 units per cell). Arrow geometry's
 *   minimum stroke / head sizes are tuned for roughly pixel-sized units,
 *   which 100 units per cell satisfies.
 */

import { squareToXY } from '@pkgs/chess-board-core-shared/geometry';
import type { BoardOrientation, Square } from '@pkgs/chess-board-core-shared/types';

export const BOARD_UNITS = 800;
export const CELL_UNITS = BOARD_UNITS / 8;
export const BOARD_VIEW_BOX = `0 0 ${BOARD_UNITS} ${BOARD_UNITS}`;

/** Top-left corner of `square` in board units. */
export function squareOrigin(
  square: Square,
  orientation: BoardOrientation
): { x: number; y: number } {
  const { x, y } = squareToXY(square, BOARD_UNITS, orientation);
  return { x, y };
}

/** Screen cell of `square`: column / row from the top-left, 0..7. */
export function displayCell(
  square: Square,
  orientation: BoardOrientation
): { col: number; row: number } {
  const { x, y } = squareToXY(square, 8, orientation);
  return { col: x, row: y };
}

/** Resting transform of a one-cell HTML box standing on `square`. */
export function cellTransform(
  square: Square,
  orientation: BoardOrientation
): string {
  const { col, row } = displayCell(square, orientation);
  return `translate(${col * 12.5}cqw, ${row * 12.5}cqw)`;
}

export function fmtUnits(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
