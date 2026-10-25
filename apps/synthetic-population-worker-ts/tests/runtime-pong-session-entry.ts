import { startSessionRealm } from '@apps/synthetic-population-worker-ts/session-realm';
import { PLAYABLE_GAME_DEFINITIONS } from '@libs/games-shared-ts/game-plugins';

// The continuous realms play Pong alone, so both fresh peers seek the same game.
const pong = PLAYABLE_GAME_DEFINITIONS.find((game) => game.id === 'pong');
if (pong?.automation === undefined)
  throw new Error('Pong is not registered with its continuous automation');
startSessionRealm([pong.automation]);
