import type { GameCommandContext } from '@libs/spaces-shared-ts/game';
import { GamesRoomAttr } from '@libs/spaces-shared-ts/games';
import {
  spaceMembersRestricted,
  spaceSeatMemberIds,
} from '@libs/spaces-shared-ts/space-members-messages';
import { ROOM_SCHEDULER_IDENTITY } from '@pkgs/room-root-shared-ts/builtin';
import type { HandleResult, RoomState } from '@pkgs/room-root-shared-ts/types';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { customGameAwaySince } from './custom-game-absence';
import { CustomGameAvailableAttr } from './custom-game-availability';
import type { CustomGameChoice } from './custom-game-choice';
import type { CustomGameBotWake, CustomGameWake } from './custom-game-commands';
import { rematchCustomGame } from './custom-game-configuration';
import { soloCustomGame } from './custom-game-local';
import { configuredCustomGame } from './custom-game-options';
import {
  expireCustomGame,
  playCustomGameChoice,
  playCustomGameMove,
} from './custom-game-play';
import { customGameBotMove, customGameBots } from './custom-game-position';
import {
  privateSetupChoice,
  publicCustomGameMove,
} from './custom-game-private-play';
import { customGameRefusal } from './custom-game-refusal';
import { changedCustomGames, refuseCustomGame } from './custom-game-result';
import type { CustomGame } from './custom-game-state';
import { CustomGamesAttr, newCustomGame } from './custom-game-state';

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
  return newCustomGame(ctx.commandId, ctx.identity, position);
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
  const privately = privateSetupChoice({ state, ctx, game, rules }, choice);
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
    game.turn === wake.side
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
  if (!CustomGameAvailableAttr.from(state) && !soloCustomGame(game, rules))
    return changedCustomGames(games, ctx, rules);
  if (!currentWake(game, wake)) return changedCustomGames(games, ctx, rules);
  const at = 'at' in wake ? Math.min(ctx.ts, wake.at) : ctx.ts;
  if (game.turnStartedAt !== null && at < game.turnStartedAt)
    return refuseCustomGame('choices changed');
  const expired = expireCustomGame(game, at, rules);
  if (expired !== game)
    return changedCustomGames({ ...games, current: expired }, ctx, rules);
  if (!bot || game[game.turn].kind !== 'bot')
    return changedCustomGames(games, ctx, rules);
  const move =
    'move' in wake ? wake.move : customGameBotMove(game, rules, ctx.random);
  if (move === null) throw new Error('active bot game has no legal move');
  // A bot proposes from the public position; the room alone resolves it.
  const played = publicCustomGameMove(state, game, move, rules);
  const next =
    played === null ? null : playCustomGameMove(game, played, at, rules);
  if (next === null) return refuseCustomGame('move is illegal');
  return changedCustomGames({ ...games, current: next }, ctx, rules);
}
