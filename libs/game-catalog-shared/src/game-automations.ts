import { GAME_DEFINITIONS } from '@libs/games-shared/game-plugins';

/** How a synthetic user plays each registered game on its board. */
export const GAME_AUTOMATIONS = GAME_DEFINITIONS.map((game) => game.automation);
