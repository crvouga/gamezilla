import { GAME_DEFINITIONS } from '@libs/games/game-plugins';
import { composeRoomModules } from '@libs/spaces/public/load-game-plugins';
import { createDurableObjectAdapter } from '@pkgs/room-adapter-durable-object';

import type { RoomServerEnv } from './room-server-env';

/**
 * Bind a Durable Object class from {@link RoomServerEnv}. Wall composition
 * root only — sims use `createInProcessRoomNode` (`@libs/spaces/sim`) instead.
 */
export function createRoomServerDurableObject(env: RoomServerEnv) {
  return createDurableObjectAdapter({
    modules: composeRoomModules(GAME_DEFINITIONS, () => env.clock.now()),
    clock: env.clock,
    createId: env.createId,
  });
}
