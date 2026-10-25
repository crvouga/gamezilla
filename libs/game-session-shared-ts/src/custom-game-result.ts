import type { GameCommandContext } from '@libs/spaces-shared-ts/game';
import type { Message } from '@pkgs/message-shared-ts/message';
import type { HandleResult } from '@pkgs/room-root-shared-ts/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared-ts/types';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { CustomGamesChanged } from './custom-game-commands';
import { customGameEffects } from './custom-game-effects';
import type { CustomGames } from './custom-game-state';

export function refuseCustomGame(reason: string): HandleResult {
  return { ok: false, error: { type: ROOM_ERROR_TYPE.conflict, reason } };
}

/**
 * The custom games as a choice left them, with the private events it made
 * (a setup chosen, a hand dealt), each read only by its audience.
 */
export function changedCustomGames(
  games: CustomGames,
  ctx: GameCommandContext,
  rules: TurnGames,
  change: {
    readonly reason?: string;
    readonly privately?: readonly Message[];
  } = {}
): HandleResult {
  return {
    ok: true,
    events: [
      CustomGamesChanged({
        games,
        commandId: ctx.commandId,
        reason: change.reason ?? '',
      }),
      ...(change.privately ?? []),
    ],
    effects: customGameEffects(games.current, rules),
  };
}
