/**
 * The SVG layers draw in a fixed user-unit space (`0 0 800 800`, 100 units
 * per cell) and scale to the host box, so nothing needs a pixel measurement
 * to render. Arrow geometry's minimum stroke / head sizes are tuned for
 * roughly pixel-sized units, which 100 units per cell satisfies.
 */

import { squareToXY } from '@pkgs/chess-board-core/geometry';
import type { BoardOrientation, Square } from '@pkgs/chess-board-core/types';

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

/** Board-local pixel point → board units for the given rendered width. */
export function pxToUnits(px: number, boardPx: number): number {
  return boardPx <= 0 ? 0 : (px * BOARD_UNITS) / boardPx;
}

export function fmtUnits(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
