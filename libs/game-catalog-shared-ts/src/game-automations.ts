import { TURN_GAME_DEFINITIONS } from '@libs/games-shared-ts/game-plugins';

/** How a synthetic user plays each registered game on its board. */
export const GAME_AUTOMATIONS = TURN_GAME_DEFINITIONS.map(
  (game) => game.automation
);
