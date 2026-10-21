import type { GameCommandContext } from '@libs/spaces-shared/game';
import type { Message } from '@pkgs/message-shared/message';
import type { HandleResult } from '@pkgs/room-root-shared/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared/types';
import type { TurnGames } from '@pkgs/turn-game-shared/game-rules';
import { CustomGamesChanged } from './custom-game-commands';
import { customGameEffects } from './custom-game-effects';
import type { CustomGames } from './custom-game-state';

export function refuseCustomGame(reason: string): HandleResult {
  return { ok: false, error: { type: ROOM_ERROR_TYPE.conflict, reason } };
}

/** The custom games as a choice left them, with any private setups it chose. */
export function changedCustomGames(
  games: CustomGames,
  ctx: GameCommandContext,
  rules: TurnGames,
  change: {
    readonly reason?: string;
    readonly setups?: readonly Message[];
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
      ...(change.setups ?? []),
    ],
    effects: customGameEffects(games.current, rules),
  };
}
