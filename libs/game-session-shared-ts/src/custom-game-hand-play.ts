import type { GameCommandContext } from '@libs/spaces-shared-ts/game';
import type { Message } from '@pkgs/message-shared-ts/message';
import type { HandleResult, RoomState } from '@pkgs/room-root-shared-ts/types';
import type {
  DealtHandsRules,
  TurnGames,
} from '@pkgs/turn-game-shared-ts/game-rules';
import type { CustomGameChoice } from './custom-game-choice';
import {
  customGameHandEvents,
  customGameHandsRules,
  customGameHidden,
} from './custom-game-hands';
import { playCustomGameChoice, playCustomGameMove } from './custom-game-play';
import { publicCustomGameMove } from './custom-game-private-play';
import { changedCustomGames, refuseCustomGame } from './custom-game-result';
import type { CustomGame } from './custom-game-state';
import { CustomGamesAttr } from './custom-game-state';

/**
 * A custom game whose authority deals hidden hands. The room deals as the
 * game starts and resolves every proposal with the hidden state; a device
 * predicting its own move shows nothing until the room answers, so no
 * device ever holds, or guesses, anything that depends on a hand it may not
 * see. A refused proposal changes nothing and is refused as every game's
 * is (`move is illegal`); why is the board's own preview to say, from the
 * same rules.
 */

type Decision = {
  readonly state: RoomState;
  readonly ctx: GameCommandContext;
  readonly game: CustomGame;
  readonly rules: TurnGames;
};

/** How the room records a proposal: the public action and the private events it makes. */
export type DecidedCustomGameMove =
  | { readonly action: string; readonly privately: readonly Message[] }
  | { readonly refusal: string };

/**
 * The room's decision on `proposal` in `game`: resolved with the hidden
 * state for a game with dealt hands, with both setups for a game with
 * private setups, and the proposal itself otherwise.
 */
export function decideCustomGameMove(
  state: RoomState,
  game: CustomGame,
  proposal: string,
  rules: TurnGames
): DecidedCustomGameMove {
  const hands = customGameHandsRules(game, rules);
  if (hands === undefined) {
    const action = publicCustomGameMove(state, game, proposal, rules);
    return action === null
      ? { refusal: 'move is illegal' }
      : { action, privately: [] };
  }
  const hidden = customGameHidden(state, game);
  if (hidden === null) return { refusal: 'the hands are not dealt' };
  const resolution = hands.resolve(game.fen, proposal, hidden);
  if ('refusal' in resolution) return { refusal: 'move is illegal' };
  return {
    action: resolution.action,
    privately: customGameHandEvents(state, game, {
      hidden: resolution.hidden,
      hands,
      all: false,
    }),
  };
}

function start(
  decision: Decision,
  hands: DealtHandsRules,
  choice: CustomGameChoice
): HandleResult | null {
  const { game, ctx, rules, state } = decision;
  if (game.status !== 'configuring' || !ctx.authority) return null;
  const started = playCustomGameChoice(
    game,
    choice,
    { actor: ctx.identity, now: ctx.ts },
    rules
  );
  if (started === null) return null;
  const hidden = hands.deal(started.fen, ctx.random);
  return changedCustomGames(
    { ...CustomGamesAttr.from(state), current: started },
    ctx,
    rules,
    {
      privately: customGameHandEvents(state, started, {
        hidden,
        hands,
        all: true,
      }),
    }
  );
}

function move(
  decision: Decision,
  choice: Extract<CustomGameChoice, { operation: 'move' }>
): HandleResult {
  const { game, ctx, rules, state } = decision;
  if (game.status !== 'active') return refuseCustomGame('move is illegal');
  // A device's prediction: the proposal goes to the room, the board waits.
  if (!ctx.authority) return { ok: true, events: [] };
  const decided = decideCustomGameMove(state, game, choice.uci, rules);
  if ('refusal' in decided) return refuseCustomGame(decided.refusal);
  const next = playCustomGameMove(game, decided.action, ctx.ts, rules);
  return next === null
    ? refuseCustomGame('move is illegal')
    : changedCustomGames(
        { ...CustomGamesAttr.from(state), current: next },
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
  choice: CustomGameChoice
): HandleResult | null {
  const hands = customGameHandsRules(decision.game, decision.rules);
  if (hands === undefined) return null;
  if (choice.operation === 'start') return start(decision, hands, choice);
  if (choice.operation === 'move') return move(decision, choice);
  return null;
}
