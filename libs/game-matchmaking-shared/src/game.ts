import { MutationError } from '@pkgs/sync-engine-shared/mutations-types';
import type { TurnGames } from '@pkgs/turn-game-shared/game-rules';
import type { MultiplayerGame } from './game-state';
import { endMultiplayerGame, requireUnfinished } from './game-state';
import {
  settleMultiplayerClock,
  spendMultiplayerClock,
} from './multiplayer-clock';
/** One serialized turn; only the injected rules interpret positions or actions. */
export function playMultiplayerMove(
  stored: MultiplayerGame,
  input: {
    readonly actorId: string;
    readonly revision: number;
    readonly uci: string;
    readonly nowMs: number;
  },
  rules: TurnGames
): MultiplayerGame {
  const game = settleMultiplayerClock(stored, input.nowMs, rules);
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
  const played = rules
    .forPosition(game.fen)
    .play(game.fen, input.uci, game.pgn, []);
  if (played === null)
    throw new MutationError(
      'CHESS_ILLEGAL_MOVE',
      'That multiplayer move is illegal.'
    );
  const moved: MultiplayerGame = {
    ...spendMultiplayerClock(game, input.nowMs),
    outcome: played.winner ?? 'ongoing',
    reason: played.reason,
    fen: played.position,
    pgn: played.history,
    revision: game.revision + 1,
    draw_offer_by: game.draw_offer_by === input.actorId ? input.actorId : '',
    turn: played.turn === 'white' ? game.white_id : game.black_id,
  };
  return moved.outcome === 'ongoing'
    ? moved
    : endMultiplayerGame(moved, moved.outcome, moved.reason ?? '');
}
