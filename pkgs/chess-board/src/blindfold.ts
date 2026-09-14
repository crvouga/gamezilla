/**
 * Blindfold / partial-blindfold visibility helpers.
 */

import type { PieceColor } from '@pkgs/chess-board-core/types';

export type BlindfoldMode = 'off' | 'full' | 'white' | 'black';

/** True when a piece of `color` should be hidden for the mode. */
export function isPieceBlind(mode: BlindfoldMode, color: PieceColor): boolean {
  if (mode === 'off') return false;
  if (mode === 'full') return true;
  if (mode === 'white') return color === 'w';
  return color === 'b';
}
