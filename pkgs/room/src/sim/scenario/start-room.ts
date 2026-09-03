import { type Run, type StartOptions, start, virtualHost } from '@pkgs/dst';
import type { World } from '../world-api';
import { type RoomSystemDef, WORLD_START_MS } from './define-room-system';
import type { RoomSurface } from './surface';

export type StartRoomOpts = {
  readonly seed?: number | bigint | string;
  readonly clientCount?: number;
  readonly mildFaults?: boolean;
  readonly startTime?: number;
  readonly properties?: StartOptions<RoomSurface>['properties'];
};

export async function startRoom(
  system: RoomSystemDef,
  opts?: StartRoomOpts
): Promise<Run<RoomSurface>> {
  const seed = opts?.seed ?? process.env['SIM_SEED'] ?? '42';
  return start(system, {
    seed,
    draws: [opts?.clientCount ?? 0, opts?.mildFaults ?? false],
    properties: opts?.properties ?? [],
    host: virtualHost({
      startTime: opts?.startTime ?? WORLD_START_MS,
    }),
  });
}

/** Imperative kit world for scripted pins. Prefer {@link startRoom} for new tests. */
export async function openRoomWorld(
  system: RoomSystemDef,
  opts?: StartRoomOpts
): Promise<World & AsyncDisposable> {
  const run = await startRoom(system, opts);
  const world = run._internal.surface.world;
  return Object.assign(world, {
    async [Symbol.asyncDispose]() {
      await run[Symbol.asyncDispose]();
    },
  });
}
