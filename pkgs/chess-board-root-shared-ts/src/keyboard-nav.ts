/**
 * Arrow-key focus movement across the 8×8 square grid, in *display* space so
 * "up" always moves toward the top of the screen whatever the orientation.
 */

import {
  squareToXY,
  xyToSquare,
} from '@pkgs/chess-board-core-shared-ts/geometry';
import type {
  BoardOrientation,
  Square,
} from '@pkgs/chess-board-core-shared-ts/types';

export type ArrowKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

const KEY_DELTAS: Readonly<Record<ArrowKey, readonly [number, number]>> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

export function isArrowKey(key: string): key is ArrowKey {
  return key in KEY_DELTAS;
}

/** Neighbour of `square` in the arrow direction, or null at the board edge. */
export function moveCursor(
  square: Square,
  key: ArrowKey,
  orientation: BoardOrientation
): Square | null {
  const { x, y } = squareToXY(square, 8, orientation);
  const [dx, dy] = KEY_DELTAS[key];
  const col = x + dx;
  const row = y + dy;
  if (col < 0 || col > 7 || row < 0 || row > 7) return null;
  return xyToSquare(col + 0.5, row + 0.5, 8, orientation);
}

/** Bottom-left square from the viewer's side: the natural keyboard start. */
export function defaultCursorSquare(orientation: BoardOrientation): Square {
  return orientation === 'white' ? 'a1' : 'h8';
}
