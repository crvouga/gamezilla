import type { GameCommandContext } from '@libs/spaces-shared-ts/game';
import { GamesRoomAttr } from '@libs/spaces-shared-ts/games';
import {
  spaceMembersRestricted,
  spaceSeatMemberIds,
} from '@libs/spaces-shared-ts/space-members-messages';
import { ROOM_SCHEDULER_IDENTITY } from '@pkgs/room-root-shared-ts/builtin';
import type { HandleResult, RoomState } from '@pkgs/room-root-shared-ts/types';
import {
  gameSides,
  type TurnGames,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { customGameAwaySince } from './custom-game-absence';
import { CustomGameAvailableAttr } from './custom-game-availability';
import type { CustomGameChoice } from './custom-game-choice';
import type { CustomGameBotWake, CustomGameWake } from './custom-game-commands';
import {
  commitCustomGameSide,
  commitmentChoice,
} from './custom-game-commit-play';
import { rematchCustomGame } from './custom-game-configuration';
import {
  dealtHandsChoice,
  decideCustomGameMove,
} from './custom-game-hand-play';
import {
  customGameHand,
  customGameHandsRules,
  customGameHidden,
} from './custom-game-hands';
import { soloCustomGame } from './custom-game-local';
import { configuredCustomGame } from './custom-game-options';
import {
  expireCustomGame,
  playCustomGameChoice,
  playCustomGameMove,
} from './custom-game-play';
import { customGameBotMove, customGameBots } from './custom-game-position';
import { privateSetupChoice } from './custom-game-private-play';
import { customGameRefusal } from './custom-game-refusal';
import { changedCustomGames, refuseCustomGame } from './custom-game-result';
import type { CustomGame } from './custom-game-state';
import {
  CustomGamesAttr,
  customGameBotPlays,
  newCustomGame,
} from './custom-game-state';

/** The game a new custom game is of: the one asked for, else the space's. */
function gameForChoice(state: RoomState, choice: CustomGameChoice): string {
  const explicit = choice.operation === 'create' ? choice.game : undefined;
  return explicit ?? GamesRoomAttr.selected.from(state) ?? '';
}

/** A rematch of the current game, or a new one of a game offering Custom Games. */
function createdCustomGame(
  state: RoomState,
  ctx: GameCommandContext,
  choice: CustomGameChoice,
  context: {
    readonly game: CustomGame | null;
    readonly members: readonly string[];
    readonly rules: TurnGames;
  }
): CustomGame | null {
  const { game, members, rules } = context;
  const id =
    choice.operation === 'rematch' && game !== null
      ? rules.forPosition(game.fen).id
      : gameForChoice(state, choice);
  // A game no longer offering custom games is refused, rematches included.
  if (!rules.offers(id, 'custom-games')) return null;
  if (choice.operation === 'rematch' && game !== null)
    return rematchCustomGame(game, ctx.commandId, members, rules);
  const simulation = rules.simulation(id);
  const position =
    simulation === undefined
      ? rules.byId(id).initial()
      : simulation.codec.encode(simulation.initialize(ctx.commandId));
  return newCustomGame(
    ctx.commandId,
    ctx.identity,
    position,
    gameSides(rules.byId(id))
  );
}

export function handleCustomGameChoice(
  state: RoomState,
  ctx: GameCommandContext,
  choice: CustomGameChoice,
  rules: TurnGames
): HandleResult {
  const games = CustomGamesAttr.from(state);
  const members = spaceSeatMemberIds(state);
  // Domain membership also removes the authority of a connection admitted
  // before a departure. Capability grants are checked at the room boundary.
  if (!members.includes(ctx.identity))
    return refuseCustomGame('not in the space');
  const game = games.current;
  if (
    !CustomGameAvailableAttr.from(state) &&
    (game === null || !soloCustomGame(game, rules))
  )
    return refuseCustomGame('the Custom Game is temporarily unavailable');
  const expired = game === null ? null : expireCustomGame(game, ctx.ts, rules);
  if (expired !== game)
    return changedCustomGames({ ...games, current: expired }, ctx, rules, {
      reason: 'finished',
    });
  const reason = customGameRefusal(game, choice, ctx.identity, {
    members,
    restricted: (a, b) => spaceMembersRestricted(state, a, b),
    awaySince: (person) => customGameAwaySince(state, person),
    now: ctx.ts,
  });
  if (reason !== '') return refuseCustomGame(reason);
  if (choice.operation === 'create' || choice.operation === 'rematch') {
    const created = createdCustomGame(state, ctx, choice, {
      game,
      members,
      rules,
    });
    if (created === null)
      return refuseCustomGame('the game offers no Custom Games');
    return changedCustomGames(
      {
        current: created,
        history: game === null ? games.history : [...games.history, game],
      },
      ctx,
      rules
    );
  }
  if (game === null) return refuseCustomGame('no Custom Game');
  if (
    choice.operation === 'difficulty' &&
    !customGameBots(game, rules).difficulties.includes(choice.difficulty)
  )
    return refuseCustomGame('difficulty not offered');
  const decision = { state, ctx, game, rules };
  const privately =
    privateSetupChoice(decision, choice) ??
    commitmentChoice(decision, choice) ??
    dealtHandsChoice(decision, choice);
  if (privately !== null) return privately;
  const configured = configuredCustomGame(game, choice, ctx.identity, rules);
  if (configured.reason !== '') return refuseCustomGame(configured.reason);
  const next = playCustomGameChoice(
    configured.game,
    choice,
    { actor: ctx.identity, now: ctx.ts },
    rules
  );
  return next === null
    ? refuseCustomGame('move is illegal')
    : changedCustomGames({ ...games, current: next }, ctx, rules);
}

function currentWake(
  game: CustomGame | null,
  wake: CustomGameWake
): game is CustomGame {
  return (
    game !== null &&
    game.status === 'active' &&
    game.id === wake.gameId &&
    game.moves.length === wake.ply &&
    (game.awaiting.length > 0
      ? game.awaiting.includes(wake.side)
      : game.turn === wake.side)
  );
}

/**
 * Whether someone other than the room chooses a move only the room may
 * choose: a stand-in's move for an away person's side, or a bot's whose hand
 * is the room's alone (every game with dealt hands but its creator's solo
 * practice). The creator's device predicts only its own bots' public moves.
 */
function choosesRoomBotMove(
  game: CustomGame | null,
  ctx: GameCommandContext,
  wake: CustomGameBotWake | CustomGameWake,
  rules: TurnGames
): boolean {
  if (ctx.identity === ROOM_SCHEDULER_IDENTITY || !('move' in wake))
    return false;
  if (game === null) return false;
  if (game.standIns.includes(wake.side)) return true;
  return (
    customGameHandsRules(game, rules) !== undefined &&
    !soloCustomGame(game, rules)
  );
}

/** Whether this copy cannot decide for the game's hands: it holds no hidden state. */
function lacksHiddenState(
  state: RoomState,
  ctx: GameCommandContext,
  game: CustomGame,
  rules: TurnGames
): boolean {
  return (
    !ctx.authority &&
    customGameHandsRules(game, rules) !== undefined &&
    customGameHidden(state, game) === null
  );
}

/** The bot or stand-in playing `side` commits with that side's own hand alone. */
function botCommitment(
  state: RoomState,
  ctx: GameCommandContext,
  game: CustomGame,
  rules: TurnGames
): (side: CustomGame['turn']) => HandleResult {
  return (side) => {
    const commitment =
      customGameBots(game, rules).choose?.(
        game.fen,
        game.difficulty[side],
        ctx.random,
        customGameHand(state, game, side)
      ) ?? null;
    if (commitment === null)
      throw new Error('a committing bot has no commitment');
    return commitCustomGameSide({ state, ctx, game, rules }, side, commitment);
  };
}

type BotWakeDecision = {
  readonly state: RoomState;
  readonly ctx: GameCommandContext;
  readonly game: CustomGame;
  readonly rules: TurnGames;
};

/** The bot's own choice on its wake: a commitment, or a move the room resolves. */
function playBotWake(
  decision: BotWakeDecision,
  wake: CustomGameBotWake | CustomGameWake,
  at: number
): HandleResult {
  const { state, ctx, game, rules } = decision;
  // A copy without the hidden state leaves the bot's turn to the room.
  if (lacksHiddenState(state, ctx, game, rules))
    return { ok: true, events: [] };
  if (game.awaiting.length > 0)
    return 'move' in wake
      ? commitCustomGameSide({ state, ctx, game, rules }, wake.side, wake.move)
      : botCommitment(state, ctx, game, rules)(wake.side);
  const move =
    'move' in wake
      ? wake.move
      : customGameBotMove(game, rules, {
          random: ctx.random,
          hand: customGameHand(state, game, game.turn),
        });
  if (move === null) throw new Error('active bot game has no legal move');
  // A bot proposes from the public position and its own hand; the room
  // alone resolves it.
  const decided = decideCustomGameMove(state, game, move, rules);
  if ('refusal' in decided) return refuseCustomGame(decided.refusal);
  const next = playCustomGameMove(game, decided.action, at, rules);
  if (next === null) return refuseCustomGame('move is illegal');
  return changedCustomGames(
    { ...CustomGamesAttr.from(state), current: next },
    ctx,
    rules,
    {
      privately: decided.privately,
    }
  );
}

export function handleCustomGameWake(
  state: RoomState,
  ctx: GameCommandContext,
  action: {
    wake: CustomGameBotWake | (CustomGameWake & { at: number });
    bot: boolean;
  },
  rules: TurnGames
): HandleResult {
  const { wake, bot } = action;
  const games = CustomGamesAttr.from(state);
  const game = games.current;
  if (
    ctx.identity !== ROOM_SCHEDULER_IDENTITY &&
    !(
      game?.creator === ctx.identity &&
      'at' in wake &&
      (bot || soloCustomGame(game, rules))
    )
  )
    return refuseCustomGame('only the game may move a bot or end a clock');
  if (choosesRoomBotMove(game, ctx, wake, rules))
    return refuseCustomGame('only the game may move a bot or end a clock');
  if (!CustomGameAvailableAttr.from(state) && !soloCustomGame(game, rules))
    return changedCustomGames(games, ctx, rules);
  if (!currentWake(game, wake)) return changedCustomGames(games, ctx, rules);
  const at = 'at' in wake ? Math.min(ctx.ts, wake.at) : ctx.ts;
  if (game.turnStartedAt !== null && at < game.turnStartedAt)
    return refuseCustomGame('choices changed');
  const expired = expireCustomGame(game, at, rules);
  if (expired !== game)
    return changedCustomGames({ ...games, current: expired }, ctx, rules);
  if (!bot || !customGameBotPlays(game, wake.side))
    return changedCustomGames(games, ctx, rules);
  return playBotWake({ state, ctx, game, rules }, wake, at);
}
