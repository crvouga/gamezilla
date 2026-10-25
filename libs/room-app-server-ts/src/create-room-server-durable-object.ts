import {
  GAME_DEFINITIONS,
  TURN_GAME_DEFINITIONS,
} from '@libs/games-shared-ts/game-plugins';
import type { RoomServerEnv } from '@libs/room-app-shared-ts/room-server-env';
import { composeRoomModules } from '@libs/spaces-shared-ts/load-game-plugins';
import { createSpaceRoomAuthorizer } from '@libs/spaces-shared-ts/space-room-authorize';
import { createDurableObjectAdapter } from '@pkgs/room-adapter-durable-object-server-ts/adapter';
import type { DurableObjectTelemetry } from '@pkgs/room-adapter-durable-object-shared-ts/types';
import { ROOM_SERVICE_IDENTITY } from '@pkgs/room-root-shared-ts/service-identity';
import {
  createTurnGames,
  prepareTurnGames,
} from '@pkgs/turn-game-shared-ts/game-rules';

const TURN_GAMES = createTurnGames(
  TURN_GAME_DEFINITIONS.map((game) => game.turnGame)
);

/**
 * Bind a Durable Object class from {@link RoomServerEnv}. Wall composition
 * root only — harnesses use `createInProcessRoomNode` (`@libs/spaces/harness`) instead.
 */
export function createRoomServerDurableObject<WorkerEnv>(
  env: RoomServerEnv,
  telemetry: (workerEnv: WorkerEnv) => DurableObjectTelemetry
) {
  return createDurableObjectAdapter({
    modules: composeRoomModules(
      GAME_DEFINITIONS,
      () => env.clock.now(),
      env.random
    ),
    // Grants arrive with each connection from the API room gateway.
    authorize: createSpaceRoomAuthorizer(GAME_DEFINITIONS),
    // A game's rule data (a word list) loads before its room decides.
    ready: () => prepareTurnGames(TURN_GAMES),
    clock: env.clock,
    timers: env.timers,
    createId: env.createId,
    telemetry,
    serviceIdentity: ROOM_SERVICE_IDENTITY,
  });
}
