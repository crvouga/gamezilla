import type { PieceCode, PieceColor } from './types';

/** `wp` / `bk` … for a color + type, or null for an unknown type letter. */
export function pieceCode(color: PieceColor, type: string): PieceCode | null {
  if (
    type !== 'p' &&
    type !== 'n' &&
    type !== 'b' &&
    type !== 'r' &&
    type !== 'q' &&
    type !== 'k'
  ) {
    return null;
  }
  return `${color}${type}`;
}
