import { Chess, type Color } from 'chess.js';
import type { CustomGame, CustomGameSide } from './custom-game-state';

export function customGameChess(game: CustomGame): Chess {
  const chess = new Chess();
  for (const move of game.moves) chess.move(customGameMoveInput(move.uci));
  return chess;
}

export function customGameMoveInput(uci: string): {
  from: string;
  to: string;
  promotion?: string;
} {
  const promotion = uci[4];
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    ...(promotion === undefined ? {} : { promotion }),
  };
}

function bishopColor(piece: { readonly square: string }): number {
  return (piece.square.charCodeAt(0) + Number(piece.square[1])) % 2;
}

/** Whether a side can mate in a legal continuation, including enemy blocking pieces. */
export function customGameCanMate(chess: Chess, side: CustomGameSide): boolean {
  const color: Color = side === 'white' ? 'w' : 'b';
  const pieces = chess
    .board()
    .flat()
    .filter((p) => p !== null);
  const ours = pieces.filter((p) => p.color === color && p.type !== 'k');
  const theirs = pieces.filter((p) => p.color !== color && p.type !== 'k');
  if (ours.some((p) => p.type === 'q' || p.type === 'r' || p.type === 'p'))
    return true;
  const knights = ours.filter((p) => p.type === 'n').length;
  const bishops = ours.filter((p) => p.type === 'b');
  if (knights >= 2 || (knights > 0 && bishops.length > 0)) return true;
  if (knights === 1) return theirs.some((p) => p.type !== 'q');
  if (bishops.length === 0) return false;
  const colors = new Set(bishops.map(bishopColor));
  if (colors.size > 1) return true;
  return theirs.some(
    (p) =>
      p.type === 'p' ||
      p.type === 'n' ||
      (p.type === 'b' && !colors.has(bishopColor(p)))
  );
}

export function customGameFenAt(game: CustomGame, ply: number): string | null {
  if (!Number.isInteger(ply) || ply < 0 || ply > game.moves.length) return null;
  return customGameChess({ ...game, moves: game.moves.slice(0, ply) }).fen();
}

export function customGameLegalMoves(game: CustomGame): readonly string[] {
  return customGameChess(game)
    .moves({ verbose: true })
    .map((move) => move.from + move.to + (move.promotion ?? ''));
}
