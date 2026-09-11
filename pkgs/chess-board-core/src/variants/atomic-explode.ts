/**
 * Atomic chess explosion hook: squares cleared when a capture explodes.
 * Pure geometry — the board `explode` handle animates these squares.
 */

import { indexFromSquare, squareFromIndex } from '../geometry';
import type { Position, Square } from '../types';

const NEIGHBOR_DELTAS: readonly [number, number][] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

/** Capture square + adjacent non-pawn pieces (atomic rules of thumb). */
export function atomicExplosionSquares(
  position: Position,
  captureSquare: Square
): readonly Square[] {
  const out: Square[] = [captureSquare];
  const file = captureSquare.charCodeAt(0) - 97;
  const rank = captureSquare.charCodeAt(1) - 49;
  for (const [df, dr] of NEIGHBOR_DELTAS) {
    const f = file + df;
    const r = rank + dr;
    if (f < 0 || f > 7 || r < 0 || r > 7) continue;
    const sq = squareFromIndex(r * 8 + f);
    const piece = position[indexFromSquare(sq)];
    if (piece === null || piece === undefined) continue;
    if (piece.type === 'p') continue;
    out.push(sq);
  }
  return out;
}
