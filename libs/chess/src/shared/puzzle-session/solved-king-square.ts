import type { Square } from '@pkgs/chess-board-core/types';

const FILES = 'abcdefgh';

function squareFromFileRank(file: number, rank: number): Square {
  return `${FILES[file]}${rank}` as Square;
}

function fenActiveColor(fen: string): 'w' | 'b' {
  const active = fen.trim().split(/\s+/)[1];
  return active === 'b' ? 'b' : 'w';
}

function findKingSquare(placement: string, color: 'w' | 'b'): Square | null {
  let rank = 8;
  let file = 0;
  for (const ch of placement) {
    if (ch === '/') {
      rank -= 1;
      file = 0;
      continue;
    }
    if (ch >= '1' && ch <= '8') {
      file += Number(ch);
      continue;
    }
    const isKing =
      (ch === 'K' && color === 'w') || (ch === 'k' && color === 'b');
    if (isKing) return squareFromFileRank(file, rank);
    file += 1;
  }
  return null;
}

/** Mated king square after mate (active color in FEN is the side in checkmate). */
export function solvedPuzzleKingSquare(displayFen: string): Square {
  const losingColor = fenActiveColor(displayFen);
  const placement = displayFen.trim().split(/\s+/)[0] ?? '';
  const king = findKingSquare(placement, losingColor);
  if (king !== null) return king;
  return (losingColor === 'w' ? 'e1' : 'e8') as Square;
}
