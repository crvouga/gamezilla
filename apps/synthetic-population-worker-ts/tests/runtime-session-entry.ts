import { startSessionRealm } from '@apps/synthetic-population-worker-ts/session-realm';
import { GAME_DEFINITIONS } from '@libs/games-shared-ts/game-plugins';
import { gameSides } from '@pkgs/turn-game-shared-ts/game-rules';

// These native scenarios require two real people to form the same match before a fault.
const game = GAME_DEFINITIONS.find(
  (candidate) =>
    candidate.turnGame.capabilities.matchmaking !== undefined &&
    gameSides(candidate.turnGame.rules).length === 2
);
if (game === undefined)
  throw new Error('No two-person matching game is registered');
startSessionRealm([game.automation]);
