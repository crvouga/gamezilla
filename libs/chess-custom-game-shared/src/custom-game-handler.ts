import type { GameCommandContext } from '@libs/spaces-shared/game';
import { spaceSeatMemberIds } from '@libs/spaces-shared/space-members-messages';
import type { HandleResult, RoomState } from '@pkgs/room-shared/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-shared/types';
import { ROOM_SCHEDULER_IDENTITY } from '@pkgs/room-shared/builtin';
import type { CustomGameChoice } from './custom-game-choice';
import {
  configureCustomGame,
  rematchCustomGame,
} from './custom-game-configuration';
import {
  expireCustomGame,
  playCustomGameChoice,
  playCustomGameMove,
} from './custom-game-play';
import { customGameLegalMoves } from './custom-game-position';
import { customGameRefusal } from './custom-game-refusal';
import type { CustomGame, CustomGames } from './custom-game-state';
import { CustomGamesAttr, newCustomGame } from './custom-game-state';
import { CustomGamesChanged } from './custom-game-commands';
import type { CustomGameWake } from './custom-game-commands';
import { customGameEffects } from './custom-game-effects';

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
  const reason = customGameRefusal(game, choice, ctx.identity, members);
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
  wake: CustomGameWake,
  bot: boolean
): HandleResult {
  if (ctx.identity !== ROOM_SCHEDULER_IDENTITY)
    return refuseCustomGame('only the game may move a bot or end a clock');
  const games = CustomGamesAttr.from(state);
  const game = games.current;
  if (!currentWake(game, wake)) return changedCustomGames(games, ctx);
  const expired = expireCustomGame(game, ctx.ts);
  if (expired !== game)
    return changedCustomGames({ ...games, current: expired }, ctx);
  if (!bot || game[game.turn].kind !== 'bot')
    return changedCustomGames(games, ctx);
  const moves = customGameLegalMoves(game);
  const index = Math.floor(ctx.random() * moves.length);
  const move = moves[index];
  if (move === undefined) throw new Error('active bot game has no legal move');
  const next = playCustomGameMove(game, move, ctx.ts);
  if (next === null) throw new Error('generated bot move is illegal');
  return changedCustomGames({ ...games, current: next }, ctx);
}
