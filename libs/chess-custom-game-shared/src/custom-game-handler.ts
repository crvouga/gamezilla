import type { GameCommandContext } from '@libs/spaces-shared/game';
import {
  spaceMemberAwaySince,
  spaceMembersRestricted,
  spaceSeatMemberIds,
} from '@libs/spaces-shared/space-members-messages';
import { ROOM_SCHEDULER_IDENTITY } from '@pkgs/room-root-shared/builtin';
import type { HandleResult, RoomState } from '@pkgs/room-root-shared/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared/types';
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
import { customGameLegalMoves } from './custom-game-position';
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
  choice: CustomGameChoice
): HandleResult {
  const games = CustomGamesAttr.from(state);
  const members = spaceSeatMemberIds(state);
  // Domain membership also removes the authority of a connection admitted
  // before a departure. Capability grants are checked at the room boundary.
  if (!members.includes(ctx.identity))
    return refuseCustomGame('not in the space');
  const game = games.current;
  const expired = game === null ? null : expireCustomGame(game, ctx.ts);
  if (expired !== game)
    return changedCustomGames({ ...games, current: expired }, ctx, 'finished');
  const reason = customGameRefusal(game, choice, ctx.identity, {
    members,
    restricted: (a, b) => spaceMembersRestricted(state, a, b),
    awaySince: (person) => spaceMemberAwaySince(state, person),
    now: ctx.ts,
  });
  if (reason !== '') return refuseCustomGame(reason);
  if (choice.operation === 'create' || choice.operation === 'rematch') {
    const created =
      choice.operation === 'rematch' && game !== null
        ? rematchCustomGame(game, ctx.commandId, members)
        : newCustomGame(ctx.commandId, ctx.identity);
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
  const next = playCustomGameChoice(configured, choice, ctx.identity, ctx.ts);
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
  wake: CustomGameBotWake | (CustomGameWake & { at: number }),
  bot: boolean
): HandleResult {
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
  if (!currentWake(game, wake)) return changedCustomGames(games, ctx);
  const at = 'at' in wake ? Math.min(ctx.ts, wake.at) : ctx.ts;
  if (game.turnStartedAt !== null && at < game.turnStartedAt)
    return refuseCustomGame('choices changed');
  const expired = expireCustomGame(game, at);
  if (expired !== game)
    return changedCustomGames({ ...games, current: expired }, ctx);
  if (!bot || game[game.turn].kind !== 'bot')
    return changedCustomGames(games, ctx);
  const moves = customGameLegalMoves(game);
  const move =
    'move' in wake ? wake.move : moves[Math.floor(ctx.random() * moves.length)];
  if (move === undefined) throw new Error('active bot game has no legal move');
  const next = playCustomGameMove(game, move, at);
  if (next === null) return refuseCustomGame('move is illegal');
  return changedCustomGames({ ...games, current: next }, ctx);
}
