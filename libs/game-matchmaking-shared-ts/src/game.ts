import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type {
  GameSetups,
  TurnGames,
} from '@pkgs/turn-game-shared-ts/game-rules';
import type { MultiplayerGame } from './game-state';
import {
  awaitingSetups,
  endMultiplayerGame,
  requireUnfinished,
} from './game-state';
import {
  settleMultiplayerClock,
  spendMultiplayerClock,
} from './multiplayer-clock';

/**
 * The public action a proposal is recorded as: for a game with private
 * setups, resolved by the server with both of them; refused while a setup
 * is still being chosen or when the rules refuse it.
 */
function recordedAction(
  game: MultiplayerGame,
  proposal: string,
  setups: GameSetups | null,
  rules: TurnGames
): string {
  const setup = rules.forPosition(game.fen).setup;
  if (setup === undefined) return proposal;
  if (awaitingSetups(game) || setups === null)
    throw new MutationError(
      'CHESS_SETUP_UNFINISHED',
      'Both setups must be chosen before the first move.'
    );
  const action = setup.resolve(game.fen, proposal, setups);
  if (action === null)
    throw new MutationError(
      'CHESS_ILLEGAL_MOVE',
      'That multiplayer move is illegal.'
    );
  return action;
}

/** One serialized turn; only the injected rules interpret positions or actions. */
export function playMultiplayerMove(
  stored: MultiplayerGame,
  input: {
    readonly actorId: string;
    readonly revision: number;
    readonly uci: string;
    readonly nowMs: number;
    /** Both private setups, for a game whose sides prepare them. */
    readonly setups?: GameSetups | null;
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
  const action = recordedAction(game, input.uci, input.setups ?? null, rules);
  const played = rules
    .forPosition(game.fen)
    .play(game.fen, action, game.pgn, []);
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
