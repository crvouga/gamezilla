import { createAttrNamespace } from '@pkgs/attribute-shared/attribute';
import type { Message } from '@pkgs/message-shared/message';
import type { RoomModule, RoomState } from '@pkgs/room-root-shared/types';
import type { TurnGames } from '@pkgs/turn-game-shared/game-rules';
import { changeCustomGameAbsence } from './custom-game-absence';
import {
  CustomGameAvailabilityChanged,
  CustomGamesChanged,
} from './custom-game-commands';
import { customGameEffects } from './custom-game-effects';
import { soloCustomGame } from './custom-game-local';
import { expireCustomGame } from './custom-game-play';
import { CustomGamesAttr, customGameTimeLeft } from './custom-game-state';

const ns = createAttrNamespace('chess', 'custom');
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
    if (game !== null && game.status === 'active' && !soloCustomGame(game)) {
      game = expireCustomGame(game, now, rules);
      if (game.status === 'active')
        game = {
          ...game,
          remaining: {
            white: customGameTimeLeft(game, 'white', now),
            black: customGameTimeLeft(game, 'black', now),
          },
          turnStartedAt: available ? now : null,
        };
    }
    return {
      events: [
        CustomGameAvailabilityChanged({
          available,
          absence: changeCustomGameAbsence(state, available, now),
        }),
        CustomGamesChanged({
          games: { ...games, current: game },
          commandId: `availability:${String(now)}`,
          reason: '',
        }),
      ],
      effects: customGameEffects(game),
    };
  };
}
