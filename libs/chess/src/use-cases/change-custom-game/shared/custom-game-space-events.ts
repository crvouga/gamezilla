import type { GameCommandContext } from '@libs/spaces/public/game';
import {
  SpaceEnded,
  SpaceSeatLeft,
} from '@libs/spaces/public/room/space-members';
import type { Message } from '@pkgs/message';
import type { HandleResult, RoomState } from '@pkgs/room';
import { changedCustomGames } from './custom-game-handler';
import { replaceCustomGameSide } from '../../../shared/custom-game/custom-game-configuration';
import {
  expireCustomGame,
  finishCustomGame,
  customGameWinOrDraw,
} from '../../../shared/custom-game/custom-game-play';
import {
  CUSTOM_GAME_SIDES,
  type CustomGame,
  CustomGamesAttr,
  customGamePersonSide,
  customGameTerminal,
  OPEN_CUSTOM_GAME_SIDE,
  otherCustomGameSide,
} from '../../../shared/custom-game/custom-game-state';

function departingCustomGame(
  game: CustomGame,
  person: string,
  now: number
): CustomGame {
  if (customGameTerminal(game)) return game;
  if (game.creator === person) return finishCustomGame(game, 'cancelled', now);
  if (game.status === 'configuring')
    return CUSTOM_GAME_SIDES.reduce(
      (g, side) =>
        g[side].person === person
          ? replaceCustomGameSide(g, side, OPEN_CUSTOM_GAME_SIDE)
          : g,
      game
    );
  const side = customGamePersonSide(game, person);
  return side === null
    ? game
    : finishCustomGame(
        game,
        customGameWinOrDraw(game, otherCustomGameSide(side), 'resignation'),
        now
      );
}

export function reactCustomGameToSpaceEvent(
  state: RoomState,
  ctx: GameCommandContext,
  event: Message
): HandleResult | null {
  const games = CustomGamesAttr.from(state);
  const game = games.current;
  if (game === null || customGameTerminal(game)) return null;
  let next = expireCustomGame(game, ctx.ts);
  if (customGameTerminal(next))
    return changedCustomGames({ ...games, current: next }, ctx);
  if (SpaceEnded.is(event)) next = finishCustomGame(next, 'cancelled', ctx.ts);
  else if (SpaceSeatLeft.is(event))
    next = departingCustomGame(next, event.payload.memberId, ctx.ts);
  else return null;
  return next === game
    ? null
    : changedCustomGames({ ...games, current: next }, ctx);
}
