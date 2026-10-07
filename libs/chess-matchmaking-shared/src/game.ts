import { MutationError } from '@pkgs/sync-engine-shared/mutations-types';
import type { Chess } from 'chess.js';
import type { MultiplayerGame } from './game-state';
import {
  endMultiplayerGame,
  multiplayerBoard,
  requireUnfinished,
} from './game-state';
import {
  settleMultiplayerClock,
  spendMultiplayerClock,
} from './multiplayer-clock';

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

function legalMove(board: Chess, uci: string): void {
  try {
    board.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      ...(uci.length > 4 ? { promotion: uci.slice(4) } : {}),
    });
  } catch {
    throw new MutationError(
      'CHESS_ILLEGAL_MOVE',
      'That multiplayer move is illegal.'
    );
  }
}

/** The stored game owns legal chess moves, clocks and endings; matchmaking never does. */
export function playMultiplayerMove(
  stored: MultiplayerGame,
  input: {
    readonly actorId: string;
    readonly revision: number;
    readonly uci: string;
    readonly nowMs: number;
  }
): MultiplayerGame {
  const game = settleMultiplayerClock(stored, input.nowMs);
  requireUnfinished(game);
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
  const board = multiplayerBoard(game);
  legalMove(board, input.uci);
  const result = ending(board);
  const moved: MultiplayerGame = {
    ...spendMultiplayerClock(game, input.nowMs),
    ...result,
    fen: board.fen(),
    pgn: board.pgn(),
    revision: game.revision + 1,
    draw_offer_by: game.draw_offer_by === input.actorId ? input.actorId : '',
    turn: board.turn() === 'w' ? game.white_id : game.black_id,
  };
  return result.outcome === 'ongoing'
    ? moved
    : endMultiplayerGame(moved, result.outcome, result.reason ?? '');
}
