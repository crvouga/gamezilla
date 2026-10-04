import { Chess } from 'chess.js';

/** Canonical chess, independently replayed without the product's FEN trail. */
export function canonicalReviewPosition(
  line: { readonly fen: string; readonly moves: string },
  move: number
): string {
  const chess = new Chess(line.fen);
  const moves = line.moves.trim().split(/\s+/).slice(0, move);
  for (const uci of moves) {
    chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      ...(uci.length === 5 ? { promotion: uci.slice(4, 5) } : {}),
    });
  }
  return chess.fen();
}
