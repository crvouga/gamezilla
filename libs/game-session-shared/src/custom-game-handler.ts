import type { GameCommandContext } from '@libs/spaces-shared/game';
import { GamesRoomAttr } from '@libs/spaces-shared/games';
import {
  spaceMembersRestricted,
  spaceSeatMemberIds,
} from '@libs/spaces-shared/space-members-messages';
import { ROOM_SCHEDULER_IDENTITY } from '@pkgs/room-root-shared/builtin';
import type { HandleResult, RoomState } from '@pkgs/room-root-shared/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared/types';
import type { TurnGames } from '@pkgs/turn-game-shared/game-rules';
import { customGameAwaySince } from './custom-game-absence';
import { CustomGameAvailableAttr } from './custom-game-availability';
import type { CustomGameChoice } from './custom-game-choice';
import type { CustomGameBotWake, CustomGameWake } from './custom-game-commands';
import { CustomGamesChanged } from './custom-game-commands';
import {
  configureCustomGame,
  rematchCustomGame,
} from './custom-game-configuration';
import { customGameEffects } from './custom-game-effects';
import { soloCustomGame } from './custom-game-local';
import {
  expireCustomGame,
  playCustomGameChoice,
  playCustomGameMove,
} from './custom-game-play';
import { customGameRefusal } from './custom-game-refusal';
import type { CustomGame, CustomGames } from './custom-game-state';
import { CustomGamesAttr, newCustomGame } from './custom-game-state';

export function refuseCustomGame(reason: string): HandleResult {
  return { ok: false, error: { type: ROOM_ERROR_TYPE.conflict, reason } };
}

export function changedCustomGames(
  games: CustomGames,
  ctx: GameCommandContext,
  reason = ''
): HandleResult {
  return {
    ok: true,
    events: [CustomGamesChanged({ games, commandId: ctx.commandId, reason })],
    effects: customGameEffects(games.current),
  };
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
    (game === null || !soloCustomGame(game))
  )
    return refuseCustomGame('the Custom Game is temporarily unavailable');
  const expired = game === null ? null : expireCustomGame(game, ctx.ts, rules);
  if (expired !== game)
    return changedCustomGames({ ...games, current: expired }, ctx, 'finished');
  const reason = customGameRefusal(game, choice, ctx.identity, {
    members,
    restricted: (a, b) => spaceMembersRestricted(state, a, b),
    awaySince: (person) => customGameAwaySince(state, person),
    now: ctx.ts,
  });
  if (reason !== '') return refuseCustomGame(reason);
  if (choice.operation === 'create' || choice.operation === 'rematch') {
    const created =
      choice.operation === 'rematch' && game !== null
        ? rematchCustomGame(game, ctx.commandId, members, rules)
        : newCustomGame(
            ctx.commandId,
            ctx.identity,
            rules.byId(GamesRoomAttr.selected.from(state) ?? '').initial()
          );
    return changedCustomGames(
      {
        current: created,
        history: game === null ? games.history : [...games.history, game],
      },
      ctx
    );
  }
  if (game === null) return refuseCustomGame('no Custom Game');
  const configured = configureCustomGame(game, choice, ctx.identity);
  const next = playCustomGameChoice(
    configured,
    choice,
    { actor: ctx.identity, now: ctx.ts },
    rules
  );
  return next === null
    ? refuseCustomGame('move is illegal')
    : changedCustomGames({ ...games, current: next }, ctx);
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
      (bot || soloCustomGame(game))
    )
  )
    return refuseCustomGame('only the game may move a bot or end a clock');
  if (!CustomGameAvailableAttr.from(state) && !soloCustomGame(game))
    return changedCustomGames(games, ctx);
  if (!currentWake(game, wake)) return changedCustomGames(games, ctx);
  const at = 'at' in wake ? Math.min(ctx.ts, wake.at) : ctx.ts;
  if (game.turnStartedAt !== null && at < game.turnStartedAt)
    return refuseCustomGame('choices changed');
  const expired = expireCustomGame(game, at, rules);
  if (expired !== game)
    return changedCustomGames({ ...games, current: expired }, ctx);
  if (!bot || game[game.turn].kind !== 'bot')
    return changedCustomGames(games, ctx);
  const move =
    'move' in wake
      ? wake.move
      : rules
          .forPosition(game.fen)
          .choose(game.fen, game.difficulty[game.turn], ctx.random);
  if (move === null) throw new Error('active bot game has no legal move');
  const next = playCustomGameMove(game, move, at, rules);
  if (next === null) return refuseCustomGame('move is illegal');
  return changedCustomGames({ ...games, current: next }, ctx);
}
