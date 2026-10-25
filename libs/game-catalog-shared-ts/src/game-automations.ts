import { REGISTERED_GAME_DEFINITIONS } from '@libs/games-shared-ts/game-plugins';

/** How a synthetic user plays each registered game on its board. */
export const GAME_AUTOMATIONS = REGISTERED_GAME_DEFINITIONS.flatMap((game) =>
  game.automation === undefined ? [] : [game.automation]
);
