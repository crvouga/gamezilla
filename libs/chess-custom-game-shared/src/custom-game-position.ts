import { Chess } from 'chess.js';
import type { CustomGame } from './custom-game-state';

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

export function customGameFenAt(game: CustomGame, ply: number): string | null {
  if (!Number.isInteger(ply) || ply < 0 || ply > game.moves.length) return null;
  return customGameChess({ ...game, moves: game.moves.slice(0, ply) }).fen();
}

export function customGameLegalMoves(game: CustomGame): readonly string[] {
  return customGameChess(game)
    .moves({ verbose: true })
    .map((move) => move.from + move.to + (move.promotion ?? ''));
}
