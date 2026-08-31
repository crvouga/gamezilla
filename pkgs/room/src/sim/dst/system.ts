import type { World } from '../world-api';
import type { RoomDstApp } from './app';

/**
 * Mutable system bag shared by `room.*` node kinds and action dispatch.
 * Built once per `openDstWorld` call by `defineRoomDst`.
 */
export type RoomDstSystem = {
  readonly app: RoomDstApp;
  world: World | null;
};

export function requireWorld(system: RoomDstSystem): World {
  const world = system.world;
  if (world === null) {
    throw new Error('room DST: room.server node has not booted');
  }
  return world;
}
