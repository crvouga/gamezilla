import { GAME_DEFINITIONS } from '@libs/games-shared-ts/game-plugins';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';

/** The registered games are the single authority for the injected catalog. */
export const TURN_GAMES = createTurnGames(
  GAME_DEFINITIONS.map((game) => game.turnGame)
);
