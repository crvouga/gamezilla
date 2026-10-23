import type { GameCommandContext } from '@libs/spaces-shared-ts/game';
import { SpaceEnded } from '@libs/spaces-shared-ts/space-log-messages';
import { SpaceSeatLeft } from '@libs/spaces-shared-ts/space-members-messages';
import type { Message } from '@pkgs/message-shared-ts/message';
import type { HandleResult, RoomState } from '@pkgs/room-root-shared-ts/types';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { replaceCustomGameSide } from './custom-game-configuration';
import {
  customGameWinOrDraw,
  expireCustomGame,
  finishCustomGame,
} from './custom-game-play';
import { changedCustomGames } from './custom-game-result';
import type { CustomGame } from './custom-game-state';
import {
  CUSTOM_GAME_SIDES,
  CustomGamesAttr,
  customGamePersonSide,
  customGameTerminal,
  OPEN_CUSTOM_GAME_SIDE,
  otherCustomGameSide,
} from './custom-game-state';

function departingCustomGame(
  game: CustomGame,
  person: string,
  now: number,
  rules: TurnGames
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
        customGameWinOrDraw(
          game,
          otherCustomGameSide(side),
          'resignation',
          rules
        ),
        now
      );
}

export function reactCustomGameToSpaceEvent(
  state: RoomState,
  ctx: GameCommandContext,
  event: Message,
  rules: TurnGames
): HandleResult | null {
  if (!SpaceEnded.is(event) && !SpaceSeatLeft.is(event)) return null;
  const games = CustomGamesAttr.from(state);
  const game = games.current;
  if (game === null || customGameTerminal(game)) return null;
  let next = expireCustomGame(game, ctx.ts, rules);
  if (customGameTerminal(next))
    return changedCustomGames({ ...games, current: next }, ctx, rules);
  if (SpaceEnded.is(event)) next = finishCustomGame(next, 'cancelled', ctx.ts);
  else if (SpaceSeatLeft.is(event))
    next = departingCustomGame(next, event.payload.memberId, ctx.ts, rules);
  else return null;
  return next === game
    ? null
    : changedCustomGames({ ...games, current: next }, ctx, rules);
}
