/**
 * The one "can this side still checkmate?" rule, decided on material alone.
 *
 * FIDE Laws of Chess, Article 6.9: a player whose time runs out loses, except
 * that "the game is drawn if the position is such that the opponent cannot
 * checkmate the player's king by any possible series of legal moves". The
 * same test decides resignations and abandoned games.
 */
import type { Chess, Color, PieceSymbol } from 'chess.js';

type Man = {
  readonly type: PieceSymbol;
  readonly color: Color;
  /** Shade of the square it stands on; only compared between bishops. */
  readonly shade: number;
};

function menOf(chess: Chess): readonly Man[] {
  return chess
    .board()
    .flat()
    .flatMap((cell) =>
      cell === null || cell.type === 'k'
        ? []
        : [
            {
              type: cell.type,
              color: cell.color,
              shade:
                (cell.square.charCodeAt(0) + cell.square.charCodeAt(1)) % 2,
            },
          ]
    );
}

/**
 * Whether `color` could still checkmate by some series of legal moves from
 * this material, however unlikely (FIDE 6.9):
 *
 * - a pawn, rook or queen always can;
 * - knights and bishops with at least one knight can, except a lone knight
 *   facing nothing but queens (or a bare king): one of the queens hemming in
 *   their own king always takes the checking knight;
 * - bishops alone can only when the board holds bishops on both square
 *   colours, or any pawn or knight, of either colour: otherwise the check
 *   leaves two flight squares of the other colour that only a rook or queen
 *   could fill, and from there it takes the bishop or blocks the check;
 * - a bare king cannot.
 *
 * Material only: "cannot" is exact for every arrangement of the pieces, while
 * "can" does not prove the pieces as they stand may be untangled into a mate.
 */
export function canCheckmate(chess: Chess, color: Color): boolean {
  const men = menOf(chess);
  const own = men.filter((man) => man.color === color);
  if (own.some((m) => m.type === 'p' || m.type === 'r' || m.type === 'q'))
    return true;
  if (own.some((man) => man.type === 'n'))
    return (
      own.length > 1 ||
      men.some((man) => man.color !== color && man.type !== 'q')
    );
  if (own.length === 0) return false;
  const bishops = men.filter((man) => man.type === 'b');
  return (
    bishops.some((bishop) => bishop.shade !== bishops[0]?.shade) ||
    men.some((man) => man.type === 'p' || man.type === 'n')
  );
}
