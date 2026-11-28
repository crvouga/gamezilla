import type { GameCommandContext } from '@libs/spaces-shared-ts/game';
import type { Message } from '@pkgs/message-shared-ts/message';
import type { HandleResult } from '@pkgs/room-root-shared-ts/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared-ts/types';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { GameSessionsChanged } from './game-session-commands';
import { gameSessionEffects } from './game-session-effects';
import type { GameSessions } from './game-session-state';

export function refuseGameSession(reason: string): HandleResult {
  return { ok: false, error: { type: ROOM_ERROR_TYPE.conflict, reason } };
}

/**
 * The game sessions as a choice left them, with the private events it made
 * (a setup chosen, a hand dealt), each read only by its audience.
 */
export function changedGameSessions(
  games: GameSessions,
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
      GameSessionsChanged({
        games,
        commandId: ctx.commandId,
        reason: change.reason ?? '',
      }),
      ...(change.privately ?? []),
    ],
    effects: gameSessionEffects(games.current, rules),
  };
}
