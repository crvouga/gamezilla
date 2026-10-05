import type { Chess, Color, PieceSymbol } from 'chess.js';

type Piece = { readonly type: PieceSymbol; readonly light: boolean };

function piecesOf(board: Chess, color: Color): Piece[] {
  const pieces: Piece[] = [];
  board.board().forEach((rank, row) => {
    rank.forEach((square, file) => {
      if (square === null || square.color !== color || square.type === 'k')
        return;
      pieces.push({ type: square.type, light: (row + file) % 2 === 0 });
    });
  });
  return pieces;
}

function bishopsCanMate(own: readonly Piece[], other: readonly Piece[]) {
  const colours = new Set(own.map((p) => p.light));
  if (colours.size > 1) return true;
  const shade = own[0]!.light;
  return other.some((p) => p.type !== 'b' || p.light !== shade);
}

/**
 * Whether `color` could still checkmate by some series of legal moves
 * (FIDE Laws of Chess, Article 6.9), however unlikely: a bare king cannot,
 * and a lone minor piece needs the other side's own pieces to help.
 */
export function canCheckmate(board: Chess, color: Color): boolean {
  const own = piecesOf(board, color);
  if (own.some((p) => p.type === 'p' || p.type === 'r' || p.type === 'q'))
    return true;
  if (own.length === 0) return false;
  const other = piecesOf(board, color === 'w' ? 'b' : 'w');
  const knights = own.filter((p) => p.type === 'n').length;
  if (knights > 0) return own.length > 1 || other.length > 0;
  return bishopsCanMate(own, other);
}
