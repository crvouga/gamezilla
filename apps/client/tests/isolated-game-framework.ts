/** The public game experience, with no application registry or concrete plugin. */
import { createTurnGames } from '@pkgs/turn-game-shared/game-rules';

export { defineGameClient } from '@libs/game-menu-client/game-client';
export { GameMenu } from '@libs/game-menu-client/game-menu';
export { createPersonalPuzzleStatsClients } from '@libs/game-menu-client/personal-puzzle-stats-clients';
export const games = createTurnGames([]);
