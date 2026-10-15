import { canCheckmate } from '@pkgs/chess-rules-shared/mating-material';
import type {
  GameRules,
  PlayedPosition,
} from '@pkgs/turn-game-shared/game-rules';
import { Chess, DEFAULT_POSITION, validateFen } from 'chess.js';
import { chessRecord } from './chess-record';
export function chessMoveInput(action: string) {
  return {
    from: action.slice(0, 2),
    to: action.slice(2, 4),
    ...(action[4] === undefined ? {} : { promotion: action[4] }),
  };
}
function boardFrom(
  position: string,
  history = '',
  actions: readonly string[] = []
): Chess {
  const board = actions.length > 0 ? new Chess() : new Chess(position);
  if (history !== '') board.loadPgn(history);
  else for (const action of actions) board.move(chessMoveInput(action));
  return board;
}
function result(board: Chess): Pick<PlayedPosition, 'winner' | 'reason'> {
  if (board.isCheckmate())
    return {
      winner: board.turn() === 'w' ? 'black' : 'white',
      reason: 'checkmate',
    };
  if (board.isDraw())
    return {
      winner: 'draw',
      reason: board.isStalemate()
        ? 'stalemate'
        : board.isInsufficientMaterial()
          ? 'insufficient material'
          : board.isThreefoldRepetition()
            ? 'repetition'
            : 'fifty moves',
    };
  return { winner: null, reason: null };
}
export const chessRules: GameRules = {
  botDifficulties: [],
  id: 'chess',
  recognizes: (position) => validateFen(position).ok,
  initial: () => DEFAULT_POSITION,
  play(position, action, history, actions) {
    const board = boardFrom(position, history, actions);
    if (board.isGameOver()) return null;
    try {
      const move = board.move(chessMoveInput(action));
      return {
        position: board.fen(),
        history: board.pgn(),
        turn: board.turn() === 'w' ? 'white' : 'black',
        label: move.san,
        ...result(board),
      };
    } catch {
      return null;
    }
  },
  replay: (actions, ply) =>
    boardFrom(DEFAULT_POSITION, '', actions.slice(0, ply)).fen(),
  legal: (position) =>
    new Chess(position)
      .moves({ verbose: true })
      .map((m) => m.from + m.to + (m.promotion ?? '')),
  canWin: (position, side) =>
    canCheckmate(new Chess(position), side === 'white' ? 'w' : 'b'),
  choose(position, _difficulty, random) {
    const legal = chessRules.legal(position);
    return legal[Math.floor(random() * legal.length)] ?? null;
  },
  moves: (position, history, actions) =>
    boardFrom(position, history, actions)
      .history({ verbose: true })
      .map((move) => ({
        label: move.san,
        before: move.before,
        after: move.after,
      })),
  record: (position, history, metadata) =>
    chessRecord(boardFrom(position, history), metadata),
};
