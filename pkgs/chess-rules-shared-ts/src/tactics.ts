import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';
import { parseFen } from './fen';

export type HangingPiece = {
  readonly piece: PieceSymbol;
  readonly square: Square;
  readonly capture: string;
};
export type KnightFork = {
  readonly move: string;
  readonly square: Square;
  readonly targets: readonly {
    readonly piece: PieceSymbol;
    readonly square: Square;
  }[];
};

function position(fen: string): Chess | null {
  if (!parseFen(fen).ok) return null;
  const chess = new Chess(fen);
  const opponentKing = chess
    .board()
    .flat()
    .find((piece) => piece?.type === 'k' && piece.color !== chess.turn());
  if (
    opponentKing === undefined ||
    opponentKing === null ||
    chess.isAttacked(opponentKing.square, chess.turn())
  )
    return null;
  return chess;
}

/** Legal captures without any legal recapture of the capturing piece. */
export function hangingPieces(fen: string): readonly HangingPiece[] {
  const chess = position(fen);
  if (chess === null) return [];
  const found = new Map<string, HangingPiece>();
  for (const san of chess
    .moves()
    .filter((candidate) => candidate.includes('x'))) {
    const move = chess.move(san);
    const defended = chess
      .moves()
      .some((reply) => reply.includes(`x${move.to}`));
    chess.undo();
    if (defended || move.captured === undefined) continue;
    const square = move.isEnPassant()
      ? (`${move.to[0]}${move.from[1]}` as Square)
      : move.to;
    if (!found.has(square))
      found.set(square, {
        piece: move.captured,
        square,
        capture: move.lan,
      });
  }
  const values: Record<PieceSymbol, number> = {
    k: 0,
    q: 9,
    r: 5,
    b: 3,
    n: 3,
    p: 1,
  };
  return [...found.values()].sort(
    (a, b) =>
      values[b.piece] - values[a.piece] ||
      (a.square < b.square ? -1 : a.square > b.square ? 1 : 0)
  );
}

function capturesFrom(
  after: Chess,
  square: Square,
  color: Color
): ReadonlySet<string> {
  const fields = after.fen().split(' ');
  fields[1] = color;
  // Asking which captures this piece threatens, with its own king safe.
  // The opponent still has their turn to answer the threat.
  const attackerTurn = new Chess(fields.join(' '));
  return new Set(
    attackerTurn
      .moves({ square })
      .flatMap((san) => /x([a-h][1-8])/.exec(san)?.[1] ?? [])
  );
}

function forkTargets(
  after: Chess,
  square: Square,
  color: Color
): KnightFork['targets'] {
  const captures = capturesFrom(after, square, color);
  return after
    .board()
    .flat()
    .flatMap((piece) => {
      if (piece === null || piece.color === color) return [];
      if (!['k', 'q', 'r'].includes(piece.type)) return [];
      const attacked =
        piece.type === 'k'
          ? after.attackers(piece.square, color).includes(square)
          : captures.has(piece.square);
      return attacked ? [{ piece: piece.type, square: piece.square }] : [];
    });
}

/** A legal knight move threatening at least two kings, queens or rooks. */
export function knightForks(fen: string): readonly KnightFork[] {
  const chess = position(fen);
  if (chess === null) return [];
  const result: KnightFork[] = [];
  for (const move of chess.moves({ piece: 'n', verbose: true })) {
    chess.move(move);
    const targets = forkTargets(chess, move.to, move.color);
    chess.undo();
    if (targets.length >= 2)
      result.push({ move: move.lan, square: move.to, targets });
  }
  return result.sort((a, b) =>
    a.move < b.move ? -1 : a.move > b.move ? 1 : 0
  );
}
