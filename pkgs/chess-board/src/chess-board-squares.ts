import type { BoardOrientation } from '@pkgs/chess-board/chess-board-types';

/**
 * Algebraic square → board-local pixel center from public size/orientation
 * only (white: rank 1 at bottom; black: flipped). No geometry imports.
 */
export function squareCenter(
  square: string,
  size: number,
  orientation: BoardOrientation
): { x: number; y: number } {
  const file = square.charCodeAt(0) - 97;
  const rank = square.charCodeAt(1) - 49;
  const cell = size / 8;
  let col: number;
  let row: number;
  if (orientation === 'white') {
    col = file;
    row = 7 - rank;
  } else {
    col = 7 - file;
    row = rank;
  }
  const cx = col * cell + cell / 2;
  const cy = row * cell + cell / 2;
  return { x: cx, y: cy };
}
