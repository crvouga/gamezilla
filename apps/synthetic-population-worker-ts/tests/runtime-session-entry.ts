import { startSessionRealm } from '@apps/synthetic-population-worker-ts/session-realm';
import { REGISTERED_GAME_DEFINITIONS } from '@libs/games-shared-ts/game-plugins';
import { gameSides } from '@pkgs/turn-game-shared-ts/game-rules';

// These native scenarios require two real people to form the same match before a fault.
const requested = process.env['NATIVE_FIXTURE_GAME'];
const game = REGISTERED_GAME_DEFINITIONS.find(
  (candidate) =>
    (requested === undefined
      ? candidate.turnGame !== undefined
      : candidate.id === requested) &&
    candidate.registration.capabilities.matchmaking !== undefined &&
    gameSides(candidate.registration.rules).length === 2
);
if (game?.automation === undefined)
  throw new Error('No two-person matching game is registered');
startSessionRealm([game.automation]);
