import { GAME_DEFINITIONS } from '@libs/games/game-plugins';
import { composeRoomModules } from '@libs/spaces/public/load-game-plugins';
import { createSpaceRoomAuthorizer } from '@libs/spaces/public/space-room-authorize';
import { ROOM_SERVICE_IDENTITY } from '@pkgs/room/server';
import type { DurableObjectTelemetry } from '@pkgs/room-adapter-durable-object';
import { createDurableObjectAdapter } from '@pkgs/room-adapter-durable-object';

import type { RoomServerEnv } from './room-server-env';

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
    clock: env.clock,
    createId: env.createId,
    telemetry,
    serviceIdentity: ROOM_SERVICE_IDENTITY,
  });
}
