import { MutationError } from '@pkgs/sync-engine/shared';
import { Chess } from 'chess.js';

export type MultiplayerGame = {
  readonly id: string;
  readonly white_id: string;
  readonly black_id: string;
  readonly fen: string;
  readonly pgn: string;
  readonly revision: number;
  readonly turn: string;
  readonly outcome: 'ongoing' | 'white' | 'black' | 'draw';
  readonly reason: string | null;
};

function ending(board: Chess): Pick<MultiplayerGame, 'outcome' | 'reason'> {
  if (board.isCheckmate())
    return {
      outcome: board.turn() === 'w' ? 'black' : 'white',
      reason: 'checkmate',
    };
  if (board.isStalemate()) return { outcome: 'draw', reason: 'stalemate' };
  if (board.isInsufficientMaterial())
    return { outcome: 'draw', reason: 'insufficient material' };
  if (board.isThreefoldRepetition())
    return { outcome: 'draw', reason: 'repetition' };
  if (board.isDrawByFiftyMoves())
    return { outcome: 'draw', reason: 'fifty moves' };
  return { outcome: 'ongoing', reason: null };
}

/** The stored game owns legal chess moves and endings; matchmaking never does. */
export function playMultiplayerMove(
  game: MultiplayerGame,
  input: {
    readonly actorId: string;
    readonly revision: number;
    readonly uci: string;
  }
): MultiplayerGame {
  if (game.outcome !== 'ongoing')
    throw new MutationError('CHESS_GAME_OVER', 'The multiplayer game is over.');
  if (input.revision !== game.revision)
    throw new MutationError(
      'CHESS_BOARD_CHANGED',
      'Your multiplayer board has changed.'
    );
  if (game.turn !== input.actorId)
    throw new MutationError(
      'CHESS_NOT_YOUR_TURN',
      'It is not your multiplayer turn.'
    );
  const board = new Chess(game.fen);
  if (game.pgn.length > 0) board.loadPgn(game.pgn);
  try {
    board.move({
      from: input.uci.slice(0, 2),
      to: input.uci.slice(2, 4),
      ...(input.uci.length > 4 ? { promotion: input.uci.slice(4) } : {}),
    });
  } catch {
    throw new MutationError(
      'CHESS_ILLEGAL_MOVE',
      'That multiplayer move is illegal.'
    );
  }
  const result = ending(board);
  return {
    ...game,
    ...result,
    fen: board.fen(),
    pgn: board.pgn(),
    revision: game.revision + 1,
    turn:
      result.outcome === 'ongoing'
        ? board.turn() === 'w'
          ? game.white_id
          : game.black_id
        : '',
  };
}
