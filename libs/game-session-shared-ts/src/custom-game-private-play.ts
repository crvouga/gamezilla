import type { GameCommandContext } from '@libs/spaces-shared-ts/game';
import type { Message } from '@pkgs/message-shared-ts/message';
import type { HandleResult, RoomState } from '@pkgs/room-root-shared-ts/types';
import type {
  PrivateSetupRules,
  TurnGames,
} from '@pkgs/turn-game-shared-ts/game-rules';
import type { CustomGameChoice } from './custom-game-choice';
import { configureCustomGame } from './custom-game-configuration';
import { playCustomGameChoice, playCustomGameMove } from './custom-game-play';
import { changedCustomGames, refuseCustomGame } from './custom-game-result';
import {
  customGameSetupChosen,
  customGameSetupRules,
  customGameSetupSides,
  customGameSetups,
  ownCustomGameSetup,
} from './custom-game-setup';
import type { CustomGame } from './custom-game-state';
import {
  CUSTOM_GAME_SIDES,
  CustomGamesAttr,
  customGamePersonSide,
} from './custom-game-state';

/**
 * A custom game whose sides prepare private setups. Readiness carries the
 * person's setup, which only they and the room read; the room draws a bot's
 * setup when the game starts. A move is decided by the room alone, with
 * both setups: a device predicting its own move checks it against the
 * public position and shows nothing until the room answers, so no device
 * ever holds, or guesses, an outcome that depends on another's setup.
 */

type Decision = {
  readonly state: RoomState;
  readonly ctx: GameCommandContext;
  readonly game: CustomGame;
  readonly rules: TurnGames;
};

function changed(
  decision: Decision,
  current: CustomGame,
  setups: readonly Message[]
): HandleResult {
  return changedCustomGames(
    { ...CustomGamesAttr.from(decision.state), current },
    decision.ctx,
    decision.rules,
    { setups }
  );
}

function ready(
  decision: Decision,
  setup: PrivateSetupRules,
  choice: Extract<CustomGameChoice, { operation: 'ready' }>
): HandleResult {
  const { game, ctx, state } = decision;
  const side = customGamePersonSide(game, ctx.identity);
  if (side === null) return refuseCustomGame('not a participant');
  if (game.ready.includes(side)) {
    // Becoming ready again, as in every custom game, keeps the person ready
    // with the setup they confirmed; only another setup is a change.
    const confirmed = ownCustomGameSetup(state, game, ctx.identity);
    const offered =
      choice.setup === undefined ? confirmed : setup.accept(choice.setup);
    return offered !== null && offered === confirmed
      ? changed(decision, configureCustomGame(game, choice, ctx.identity), [])
      : refuseCustomGame('withdraw readiness to change the setup');
  }
  if (choice.setup === undefined)
    return refuseCustomGame('choose a setup first');
  const accepted = setup.accept(choice.setup);
  if (accepted === null) return refuseCustomGame('the setup is not complete');
  return changed(decision, configureCustomGame(game, choice, ctx.identity), [
    customGameSetupChosen(game, side, accepted),
  ]);
}

/** The room draws each bot's setup as the game starts; a device never does. */
function start(
  decision: Decision,
  setup: PrivateSetupRules,
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
  const held = customGameSetupSides(state, game);
  if (
    !CUSTOM_GAME_SIDES.every(
      (side) => game[side].kind === 'bot' || held.includes(side)
    )
  )
    return refuseCustomGame('every person must be ready');
  return changed(
    decision,
    started,
    CUSTOM_GAME_SIDES.filter((side) => game[side].kind === 'bot').map((side) =>
      customGameSetupChosen(game, side, setup.random(ctx.random))
    )
  );
}

/** The public action a proposal is recorded as, decided by the room with both setups. */
export function publicCustomGameMove(
  state: RoomState,
  game: CustomGame,
  proposal: string,
  rules: TurnGames
): string | null {
  const setup = customGameSetupRules(game, rules);
  if (setup === undefined) return proposal;
  const setups = customGameSetups(state, game);
  return setups === null ? null : setup.resolve(game.fen, proposal, setups);
}

function move(
  decision: Decision,
  choice: Extract<CustomGameChoice, { operation: 'move' }>
): HandleResult {
  const { game, ctx, rules, state } = decision;
  const legal = rules.forPosition(game.fen).legal(game.fen);
  if (game.status !== 'active' || !legal.includes(choice.uci))
    return refuseCustomGame('move is illegal');
  // A device's prediction: the move goes to the room, the board waits.
  if (!ctx.authority) return { ok: true, events: [] };
  const action = publicCustomGameMove(state, game, choice.uci, rules);
  if (action === null) return refuseCustomGame('move is illegal');
  const next = playCustomGameMove(game, action, ctx.ts, rules);
  return next === null
    ? refuseCustomGame('move is illegal')
    : changed(decision, next, []);
}

/**
 * The private-setup decision for `choice`, or `null` when the choice is
 * decided like any other game's.
 */
export function privateSetupChoice(
  decision: Decision,
  choice: CustomGameChoice
): HandleResult | null {
  const setup = customGameSetupRules(decision.game, decision.rules);
  if (setup === undefined)
    return choice.operation === 'ready' && choice.setup !== undefined
      ? refuseCustomGame('the game has no setup')
      : null;
  if (choice.operation === 'ready') return ready(decision, setup, choice);
  if (choice.operation === 'start') return start(decision, setup, choice);
  if (choice.operation === 'move') return move(decision, choice);
  return null;
}
