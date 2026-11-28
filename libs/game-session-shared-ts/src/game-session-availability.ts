import { GAME_PLATFORM_NAMESPACE } from '@libs/game-matchmaking-shared-ts/durable-names';
import { createAttrNamespace } from '@pkgs/attribute-shared-ts/attribute';
import type { Message } from '@pkgs/message-shared-ts/message';
import type { RoomModule, RoomState } from '@pkgs/room-root-shared-ts/types';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  changeGameSessionAbsence,
  GameSessionAbsenceAttr,
} from './game-session-absence';
import {
  GameSessionAvailabilityChanged,
  GameSessionsChanged,
} from './game-session-commands';
import { gameSessionEffects } from './game-session-effects';
import { soloGameSession } from './game-session-local';
import { expireGameSession } from './game-session-play';
import { gameSessionStandInEffects } from './game-session-stand-in';
import { GameSessionsAttr, gameSessionRemaining } from './game-session-state';

const ns = createAttrNamespace(GAME_PLATFORM_NAMESPACE, 'custom');
export const GameSessionAvailableAttr = ns.boolean(
  'available',
  (value) => value !== false
);

/** Freeze shared clocks before unavailable work is fenced; local games keep running. */
export function createGameSessionAvailabilityChange(
  rules: TurnGames
): NonNullable<
  RoomModule<RoomState, Message, Message, string>['availabilityChange']
> {
  return (state, available, now) => {
    if (GameSessionAvailableAttr.from(state) === available) return null;
    const games = GameSessionsAttr.from(state);
    let game = games.current;
    if (
      game !== null &&
      game.status === 'active' &&
      !soloGameSession(game, rules)
    ) {
      game = expireGameSession(game, now, rules);
      if (game.status === 'active')
        game = {
          ...game,
          remaining: gameSessionRemaining(game, now),
          turnStartedAt: available ? now : null,
        };
    }
    const absence = changeGameSessionAbsence(state, available, now);
    return {
      events: [
        GameSessionAvailabilityChanged({ available, absence }),
        GameSessionsChanged({
          games: { ...games, current: game },
          commandId: `availability:${String(now)}`,
          reason: '',
        }),
      ],
      effects: [
        ...gameSessionEffects(game, rules),
        // Time away resumes counting toward a stand-in only once available.
        ...gameSessionStandInEffects(
          { ...state, ...GameSessionAbsenceAttr(absence) },
          game,
          rules
        ),
      ],
    };
  };
}
