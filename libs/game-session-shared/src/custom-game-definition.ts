import type { GameDefinition } from '@libs/spaces-shared/game';
import type { TurnGames } from '@pkgs/turn-game-shared/game-rules';
import { createCustomGameAvailabilityChange } from './custom-game-availability';
import { customGameCmdNs, customGameEvtNs } from './custom-game-commands';
import {
  customGameEffects,
  localCustomGameEffects,
} from './custom-game-effects';
import { prepareLocalCustomGameCommand } from './custom-game-local';
import { customGameCommandPermission } from './custom-game-permissions';
import {
  createCustomGameCommandRouter,
  customGameEventReducer,
  customGameInitialAttrs,
} from './custom-game-router';
import { reactCustomGameToSpaceEvent } from './custom-game-space-events';
import { CustomGamesAttr } from './custom-game-state';

/** One custom-game lifecycle per space, composed once alongside playable plugins. */
export function withCustomGames(
  game: GameDefinition,
  rules: TurnGames
): GameDefinition {
  return {
    ...game,
    availabilityChange: createCustomGameAvailabilityChange(rules),
    prepareLocalCommand: (state, payload, at, random) =>
      prepareLocalCustomGameCommand(state, payload, { at, random }, rules),
    recoverLocalEffects: (state) =>
      localCustomGameEffects(CustomGamesAttr.from(state).current),
    recoverEffects: (state) => [
      ...game.recoverEffects(state),
      ...customGameEffects(CustomGamesAttr.from(state).current),
    ],
    reactToSpaceEvent: (state, ctx, event) =>
      reactCustomGameToSpaceEvent(state, ctx, event, rules),
    permissionForCommand: customGameCommandPermission,
    commandRouters: [
      ...game.commandRouters,
      {
        namespace: customGameCmdNs,
        router: createCustomGameCommandRouter(rules),
      },
    ],
    eventRouters: [
      ...game.eventRouters,
      { namespace: customGameEvtNs, router: customGameEventReducer },
    ],
    initialState: () => ({
      ...game.initialState?.(),
      ...customGameInitialAttrs(),
    }),
  };
}
