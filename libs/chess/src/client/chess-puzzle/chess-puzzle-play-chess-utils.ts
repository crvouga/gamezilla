import type { Chess } from 'chess.js';
import type { Move } from '@pkgs/chess-board/chess-board-types';

export function uciFromMove(m: Move): string {
  let s = m.from + m.to;
  if (m.promotion !== undefined) {
    s += m.promotion;
  }
  return s;
}

export function boardOrientationFromFen(fen: string): 'white' | 'black' {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 2) return 'white';
  return parts[1] === 'b' ? 'black' : 'white';
}

export function applyUci(chess: Chess, uci: string): boolean {
  const t = uci.trim().toLowerCase();
  if (t.length < 4) return false;
  const from = t.slice(0, 2);
  const to = t.slice(2, 4);
  const promotionChar = t.length >= 5 ? t[4] : undefined;
  const promotion =
    promotionChar === 'q' ||
    promotionChar === 'r' ||
    promotionChar === 'b' ||
    promotionChar === 'n'
      ? promotionChar
      : undefined;
  const res = chess.move({
    from,
    to,
    ...(promotion !== undefined ? { promotion } : {}),
  });
  return res !== null;
}
