import type { InMemoryRoomStorage } from '../../server/adapters/memory';
import type { World } from '../world-api';
import type { RoomApp } from './app';

/**
 * Mutable runtime bag shared by room node kinds and action dispatch.
 * Built once per `defineRoomSystem` call and closed over by node boot fns.
 */
export type RoomRuntime = {
  readonly app: RoomApp;
  readonly topic?: string;
  readonly storage?: InMemoryRoomStorage;
  kit: World | null;
};

/** @deprecated alias — prefer {@link RoomRuntime}. */
export type RoomSystem = RoomRuntime;

export function requireKit(runtime: RoomRuntime): World {
  const kit = runtime.kit;
  if (kit === null) {
    throw new Error('room DST: room.server node has not booted');
  }
  return kit;
}

/** @deprecated alias — prefer {@link requireKit}. */
export const requireWorld = requireKit;
