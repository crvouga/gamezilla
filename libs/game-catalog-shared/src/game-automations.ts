import { GAME_DEFINITIONS } from '@libs/games-shared/game-plugins';

/** Ordinary app controls supplied by the same authoritative game registry. */
export const GAME_AUTOMATIONS = GAME_DEFINITIONS.flatMap((game) =>
  'automation' in game ? [game.automation] : []
);
