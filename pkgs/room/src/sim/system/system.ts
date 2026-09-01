import type { InMemoryRoomStorage } from '../../server/adapters/memory';
import type { World } from '../world-api';
import type { RoomApp } from './app';

/**
 * Mutable system bag shared by `room.*` node kinds and action dispatch.
 * Built once per framework `openWorld` call by `defineRoomSystem`.
 * Kit world is exposed as framework `world.facade` after topology boot.
 */
export type RoomSystem = {
  readonly app: RoomApp;
  readonly topic?: string;
  readonly storage?: InMemoryRoomStorage;
  world: World | null;
};

export function requireWorld(system: RoomSystem): World {
  const world = system.world;
  if (world === null) {
    throw new Error('room DST: room.server node has not booted');
  }
  return world;
}
