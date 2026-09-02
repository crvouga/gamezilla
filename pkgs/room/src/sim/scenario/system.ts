import type { WorldPorts } from '@pkgs/dst';
import type { InMemoryRoomStorage } from '../../server/adapters/memory';
import type { World } from '../world-api';
import type { RoomApp } from './app';

/**
 * Mutable runtime bag shared by room node kinds and action dispatch.
 * One instance per `openWorld` (keyed by that world's ports).
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

/** Resolve the per-world runtime for this `openWorld` (ports are unique). */
export function bindRoomRuntime(create: () => RoomRuntime) {
  const byPorts = new WeakMap<WorldPorts, RoomRuntime>();
  return (ports: WorldPorts): RoomRuntime => {
    let runtime = byPorts.get(ports);
    if (runtime === undefined) {
      runtime = create();
      byPorts.set(ports, runtime);
    }
    return runtime;
  };
}
