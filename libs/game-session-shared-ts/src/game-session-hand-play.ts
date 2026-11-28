import type { GameCommandContext } from '@libs/spaces-shared-ts/game';
import type { Message } from '@pkgs/message-shared-ts/message';
import type { HandleResult, RoomState } from '@pkgs/room-root-shared-ts/types';
import type {
  DealtHandsRules,
  TurnGames,
} from '@pkgs/turn-game-shared-ts/game-rules';
import type { GameSessionChoice } from './game-session-choice';
import {
  gameSessionHandEvents,
  gameSessionHandsRules,
  gameSessionHidden,
} from './game-session-hands';
import {
  playGameSessionChoice,
  playGameSessionMove,
} from './game-session-play';
import { publicGameSessionMove } from './game-session-private-play';
import { changedGameSessions, refuseGameSession } from './game-session-result';
import type { GameSession } from './game-session-state';
import { GameSessionsAttr } from './game-session-state';

/**
 * A game session whose authority deals hidden hands. The room deals as the
 * game starts and resolves every proposal with the hidden state; a device
 * predicting its own move shows nothing until the room answers, so no
 * device ever holds, or guesses, anything that depends on a hand it may not
 * see. A refused proposal changes nothing; its reason is the game's own
 * (`follow suit`), told only to the person who proposed it and worded by
 * the game's presentation (`refusalDescription`).
 */

type Decision = {
  readonly state: RoomState;
  readonly ctx: GameCommandContext;
  readonly game: GameSession;
  readonly rules: TurnGames;
};

/** How the room records a proposal: the public action and the private events it makes. */
export type DecidedGameSessionMove =
  | { readonly action: string; readonly privately: readonly Message[] }
  | { readonly refusal: string };

/**
 * The room's decision on `proposal` in `game`: resolved with the hidden
 * state for a game with dealt hands, with both setups for a game with
 * private setups, and the proposal itself otherwise.
 */
export function decideGameSessionMove(
  state: RoomState,
  game: GameSession,
  proposal: string,
  rules: TurnGames
): DecidedGameSessionMove {
  const hands = gameSessionHandsRules(game, rules);
  if (hands === undefined) {
    const action = publicGameSessionMove(state, game, proposal, rules);
    return action === null
      ? { refusal: 'move is illegal' }
      : { action, privately: [] };
  }
  const hidden = gameSessionHidden(state, game);
  if (hidden === null) return { refusal: 'the hands are not dealt' };
  const resolution = hands.resolve(game.fen, proposal, hidden);
  // A refusal reaches only the person who proposed: the game words why
  // (`follow suit`), from their own hand and the public position.
  if ('refusal' in resolution) return { refusal: resolution.refusal };
  return {
    action: resolution.action,
    privately: gameSessionHandEvents(state, game, {
      hidden: resolution.hidden,
      hands,
      all: false,
    }),
  };
}

function start(
  decision: Decision,
  hands: DealtHandsRules,
  choice: GameSessionChoice
): HandleResult | null {
  const { game, ctx, rules, state } = decision;
  if (game.status !== 'configuring' || !ctx.authority) return null;
  const started = playGameSessionChoice(
    game,
    choice,
    { actor: ctx.identity, now: ctx.ts },
    rules
  );
  if (started === null) return null;
  const hidden = hands.deal(started.fen, ctx.random);
  return changedGameSessions(
    { ...GameSessionsAttr.from(state), current: started },
    ctx,
    rules,
    {
      privately: gameSessionHandEvents(state, started, {
        hidden,
        hands,
        all: true,
      }),
    }
  );
}

function move(
  decision: Decision,
  choice: Extract<GameSessionChoice, { operation: 'move' }>
): HandleResult {
  const { game, ctx, rules, state } = decision;
  if (game.status !== 'active') return refuseGameSession('move is illegal');
  // A device's prediction: the proposal goes to the room, the board waits.
  if (!ctx.authority) return { ok: true, events: [] };
  const decided = decideGameSessionMove(state, game, choice.uci, rules);
  if ('refusal' in decided) return refuseGameSession(decided.refusal);
  const next = playGameSessionMove(game, decided.action, ctx.ts, rules);
  return next === null
    ? refuseGameSession('move is illegal')
    : changedGameSessions(
        { ...GameSessionsAttr.from(state), current: next },
        ctx,
        rules,
        { privately: decided.privately }
      );
}

/**
 * The dealt-hands decision for `choice`, or `null` when the choice is
 * decided like any other game's.
 */
export function dealtHandsChoice(
  decision: Decision,
  choice: GameSessionChoice
): HandleResult | null {
  const hands = gameSessionHandsRules(decision.game, decision.rules);
  if (hands === undefined) return null;
  if (choice.operation === 'start') return start(decision, hands, choice);
  if (choice.operation === 'move') return move(decision, choice);
  return null;
}
