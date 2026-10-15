import { Chess } from 'chess.js';
import { chessMoveInput } from './chess-rules';
export function chessHistoryBoard(game: { fen: string; pgn: string }): Chess {
  const board = new Chess(game.fen);
  if (game.pgn !== '') board.loadPgn(game.pgn);
  return board;
}
export function chessCustomBoard(game: {
  moves: readonly { uci: string }[];
}): Chess {
  const board = new Chess();
  for (const move of game.moves) board.move(chessMoveInput(move.uci));
  return board;
}
