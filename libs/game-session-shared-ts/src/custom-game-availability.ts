import { GAME_PLATFORM_NAMESPACE } from '@libs/game-matchmaking-shared-ts/durable-names';
import { createAttrNamespace } from '@pkgs/attribute-shared-ts/attribute';
import type { Message } from '@pkgs/message-shared-ts/message';
import type { RoomModule, RoomState } from '@pkgs/room-root-shared-ts/types';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  CustomGameAbsenceAttr,
  changeCustomGameAbsence,
} from './custom-game-absence';
import {
  CustomGameAvailabilityChanged,
  CustomGamesChanged,
} from './custom-game-commands';
import { customGameEffects } from './custom-game-effects';
import { soloCustomGame } from './custom-game-local';
import { expireCustomGame } from './custom-game-play';
import { customGameStandInEffects } from './custom-game-stand-in';
import { CustomGamesAttr, customGameRemaining } from './custom-game-state';

const ns = createAttrNamespace(GAME_PLATFORM_NAMESPACE, 'custom');
export const CustomGameAvailableAttr = ns.boolean(
  'available',
  (value) => value !== false
);

/** Freeze shared clocks before unavailable work is fenced; local games keep running. */
export function createCustomGameAvailabilityChange(
  rules: TurnGames
): NonNullable<
  RoomModule<RoomState, Message, Message, string>['availabilityChange']
> {
  return (state, available, now) => {
    if (CustomGameAvailableAttr.from(state) === available) return null;
    const games = CustomGamesAttr.from(state);
    let game = games.current;
    if (
      game !== null &&
      game.status === 'active' &&
      !soloCustomGame(game, rules)
    ) {
      game = expireCustomGame(game, now, rules);
      if (game.status === 'active')
        game = {
          ...game,
          remaining: customGameRemaining(game, now),
          turnStartedAt: available ? now : null,
        };
    }
    const absence = changeCustomGameAbsence(state, available, now);
    return {
      events: [
        CustomGameAvailabilityChanged({ available, absence }),
        CustomGamesChanged({
          games: { ...games, current: game },
          commandId: `availability:${String(now)}`,
          reason: '',
        }),
      ],
      effects: [
        ...customGameEffects(game, rules),
        // Time away resumes counting toward a stand-in only once available.
        ...customGameStandInEffects(
          { ...state, ...CustomGameAbsenceAttr(absence) },
          game
        ),
      ],
    };
  };
}
