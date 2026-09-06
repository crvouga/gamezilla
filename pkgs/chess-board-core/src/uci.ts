/** UCI / FEN string helpers shared by board UI and puzzle logic. */

import type { Chess } from 'chess.js';
import type { BoardOrientation, Move } from './types';

export function uciFromMove(
  m: Pick<Move, 'from' | 'to' | 'promotion'>
): string {
  let s: string = m.from + m.to;
  if (m.promotion !== undefined) s += m.promotion;
  return s;
}

export type ParsedUci = {
  readonly from: string;
  readonly to: string;
  readonly promotion?: Exclude<Move['promotion'], undefined>;
};

/** Parse `e2e4` / `e7e8q`; `null` when shorter than four chars. */
export function parseUci(uci: string): ParsedUci | null {
  const t = uci.trim().toLowerCase();
  if (t.length < 4) return null;
  const promotionChar = t.length >= 5 ? t[4] : undefined;
  const promotion =
    promotionChar === 'q' ||
    promotionChar === 'r' ||
    promotionChar === 'b' ||
    promotionChar === 'n'
      ? promotionChar
      : undefined;
  return {
    from: t.slice(0, 2),
    to: t.slice(2, 4),
    ...(promotion !== undefined ? { promotion } : {}),
  };
}

/** Side to move from a FEN string, as a board orientation. */
export function boardOrientationFromFen(fen: string): BoardOrientation {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 2) return 'white';
  return parts[1] === 'b' ? 'black' : 'white';
}

/** Apply a UCI move to a live chess.js instance; false when illegal. */
export function applyUci(chess: Chess, uci: string): boolean {
  const parsed = parseUci(uci);
  if (parsed === null) return false;
  try {
    return chess.move(parsed) !== null;
  } catch {
    return false;
  }
}
