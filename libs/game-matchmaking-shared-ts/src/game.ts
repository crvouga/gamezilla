import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import {
  type GameSetups,
  type GameSide,
  type GameWinner,
  gameSides,
  plainWinner,
  type TurnGames,
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
import {
  multiplayerHandsRules,
  resolveMultiplayerHand,
} from './multiplayer-hands';
import { multiplayerOwner, multiplayerSideOf } from './multiplayer-roster';

/**
 * The public action a proposal is recorded as: for a game with dealt
 * hands, resolved by the server with the hidden state (and the hidden state
 * after it); for a game with private setups, resolved with both of them,
 * refused while a setup is still being chosen; refused when the rules
 * refuse it.
 */
function recordedAction(
  game: MultiplayerGame,
  proposal: string,
  held: { readonly setups: GameSetups | null; readonly hidden: string | null },
  rules: TurnGames
): { readonly action: string; readonly hidden: string | null } {
  const hands = multiplayerHandsRules(game, rules);
  if (hands !== undefined)
    return resolveMultiplayerHand(game, proposal, {
      hidden: held.hidden,
      hands,
    });
  const setups = held.setups;
  const setup = rules.forPosition(game.fen).setup;
  if (setup === undefined) return { action: proposal, hidden: null };
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
  return { action, hidden: null };
}

/**
 * A matched game records one winner or a draw: its rating compares people
 * by a win, a loss or a draw, so joint winners are a custom-game result only.
 */
function matchedOutcome(
  winner: GameWinner | null,
  sides: readonly GameSide[]
): MultiplayerGame['outcome'] {
  if (winner === null) return 'ongoing';
  const plain = plainWinner(winner, sides);
  if (typeof plain !== 'string')
    throw new Error('matched games record one winner or a draw');
  return plain;
}

/** A matched game after one move, and its hidden state for a game with dealt hands. */
export type MultiplayerMove = {
  readonly game: MultiplayerGame;
  readonly hidden: string | null;
};

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
    /** The hidden state, for a game whose authority deals hands. */
    readonly hidden?: string | null;
  },
  rules: TurnGames
): MultiplayerMove {
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
  if (multiplayerSideOf(game, input.actorId) === null)
    throw new MutationError(
      'CHESS_MATCHED_ONLY',
      'Only matched people can play.'
    );
  const recorded = recordedAction(
    game,
    input.uci,
    { setups: input.setups ?? null, hidden: input.hidden ?? null },
    rules
  );
  const played = rules
    .forPosition(game.fen)
    .play(game.fen, recorded.action, game.pgn, []);
  if (played === null)
    throw new MutationError(
      'CHESS_ILLEGAL_MOVE',
      'That multiplayer move is illegal.'
    );
  const moved: MultiplayerGame = {
    ...spendMultiplayerClock(game, input.nowMs),
    outcome: matchedOutcome(
      played.winner,
      gameSides(rules.forPosition(game.fen))
    ),
    reason: played.reason,
    fen: played.position,
    pgn: played.history,
    revision: game.revision + 1,
    draw_offer_by: game.draw_offer_by === input.actorId ? input.actorId : '',
    draw_votes:
      game.draw_offer_by === input.actorId ? (game.draw_votes ?? null) : null,
    turn: multiplayerOwner(game, played.turn),
  };
  return {
    game:
      moved.outcome === 'ongoing'
        ? moved
        : endMultiplayerGame(moved, moved.outcome, moved.reason ?? ''),
    hidden: recorded.hidden,
  };
}
