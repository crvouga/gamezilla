import { GAME_DEFINITIONS } from '@libs/games-shared/game-plugins';
import { createTurnGames } from '@pkgs/turn-game-shared/game-rules';

/** The registered games are the single authority for the injected catalog. */
export const TURN_GAMES = createTurnGames(
  GAME_DEFINITIONS.flatMap((game) =>
    game.turnGame === undefined ? [] : [game.turnGame]
  )
);
