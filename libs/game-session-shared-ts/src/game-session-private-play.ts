import type { GameCommandContext } from '@libs/spaces-shared-ts/game';
import type { Message } from '@pkgs/message-shared-ts/message';
import type { HandleResult, RoomState } from '@pkgs/room-root-shared-ts/types';
import type {
  PrivateSetupRules,
  TurnGames,
} from '@pkgs/turn-game-shared-ts/game-rules';
import type { GameSessionChoice } from './game-session-choice';
import { configureGameSession } from './game-session-configuration';
import {
  playGameSessionChoice,
  playGameSessionMove,
} from './game-session-play';
import { changedGameSessions, refuseGameSession } from './game-session-result';
import {
  gameSessionSetupChosen,
  gameSessionSetupRules,
  gameSessionSetupSides,
  gameSessionSetups,
  ownGameSessionSetup,
} from './game-session-setup';
import type { GameSession } from './game-session-state';
import { GameSessionsAttr, gameSessionPersonSide } from './game-session-state';

/**
 * A game session whose sides prepare private setups. Readiness carries the
 * person's setup, which only they and the room read; the room draws a bot's
 * setup when the game starts. A move is decided by the room alone, with
 * both setups: a device predicting its own move checks it against the
 * public position and shows nothing until the room answers, so no device
 * ever holds, or guesses, an outcome that depends on another's setup.
 */

type Decision = {
  readonly state: RoomState;
  readonly ctx: GameCommandContext;
  readonly game: GameSession;
  readonly rules: TurnGames;
};

function changed(
  decision: Decision,
  current: GameSession,
  setups: readonly Message[]
): HandleResult {
  return changedGameSessions(
    { ...GameSessionsAttr.from(decision.state), current },
    decision.ctx,
    decision.rules,
    { privately: setups }
  );
}

function ready(
  decision: Decision,
  setup: PrivateSetupRules,
  choice: Extract<GameSessionChoice, { operation: 'ready' }>
): HandleResult {
  const { game, ctx, state } = decision;
  const side = gameSessionPersonSide(game, ctx.identity);
  if (side === null) return refuseGameSession('not a participant');
  if (game.ready.includes(side)) {
    // Becoming ready again, as in every game session, keeps the person ready
    // with the setup they confirmed; only another setup is a change.
    const confirmed = ownGameSessionSetup(state, game, ctx.identity);
    const offered =
      choice.setup === undefined ? confirmed : setup.accept(choice.setup);
    return offered !== null && offered === confirmed
      ? changed(decision, configureGameSession(game, choice, ctx.identity), [])
      : refuseGameSession('withdraw readiness to change the setup');
  }
  if (choice.setup === undefined)
    return refuseGameSession('choose a setup first');
  const accepted = setup.accept(choice.setup);
  if (accepted === null) return refuseGameSession('the setup is not complete');
  return changed(decision, configureGameSession(game, choice, ctx.identity), [
    gameSessionSetupChosen(game, side, accepted),
  ]);
}

/** The room draws each bot's setup as the game starts; a device never does. */
function start(
  decision: Decision,
  setup: PrivateSetupRules,
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
  const held = gameSessionSetupSides(state, game);
  if (
    !game.sides.every(
      (side) => game[side].kind === 'bot' || held.includes(side)
    )
  )
    return refuseGameSession('every person must be ready');
  return changed(
    decision,
    started,
    game.sides
      .filter((side) => game[side].kind === 'bot')
      .map((side) =>
        gameSessionSetupChosen(game, side, setup.random(ctx.random))
      )
  );
}

/** The public action a proposal is recorded as, decided by the room with both setups. */
export function publicGameSessionMove(
  state: RoomState,
  game: GameSession,
  proposal: string,
  rules: TurnGames
): string | null {
  const setup = gameSessionSetupRules(game, rules);
  if (setup === undefined) return proposal;
  const setups = gameSessionSetups(state, game);
  return setups === null ? null : setup.resolve(game.fen, proposal, setups);
}

function move(
  decision: Decision,
  choice: Extract<GameSessionChoice, { operation: 'move' }>
): HandleResult {
  const { game, ctx, rules, state } = decision;
  const legal = rules.turnsForPosition(game.fen)?.legal(game.fen) ?? [];
  if (game.status !== 'active' || !legal.includes(choice.uci))
    return refuseGameSession('move is illegal');
  // A device's prediction: the move goes to the room, the board waits.
  if (!ctx.authority) return { ok: true, events: [] };
  const action = publicGameSessionMove(state, game, choice.uci, rules);
  if (action === null) return refuseGameSession('move is illegal');
  const next = playGameSessionMove(game, action, ctx.ts, rules);
  return next === null
    ? refuseGameSession('move is illegal')
    : changed(decision, next, []);
}

/**
 * The private-setup decision for `choice`, or `null` when the choice is
 * decided like any other game's.
 */
export function privateSetupChoice(
  decision: Decision,
  choice: GameSessionChoice
): HandleResult | null {
  const setup = gameSessionSetupRules(decision.game, decision.rules);
  if (setup === undefined)
    return choice.operation === 'ready' && choice.setup !== undefined
      ? refuseGameSession('the game has no setup')
      : null;
  if (choice.operation === 'ready') return ready(decision, setup, choice);
  if (choice.operation === 'start') return start(decision, setup, choice);
  if (choice.operation === 'move') return move(decision, choice);
  return null;
}
