import { defineSystem, draw, type System } from '@pkgs/dst';
import { gen } from '@pkgs/dst/fast-check';
import fc from 'fast-check';
import type { InMemoryRoomStorage } from '../../server/adapters/memory';
import { createRoomWorld } from '../world';
import type { RoomApp } from './app';
import type { RoomSurface } from './surface';

const WORLD_START_MS = 1_700_000_000_000;

export type DefineRoomSystemOpts = {
  readonly name?: string;
  readonly topic?: string;
  readonly storage?: InMemoryRoomStorage;
};

export type RoomSystemDef = System<RoomSurface>;

async function bootClients(
  world: Awaited<ReturnType<typeof createRoomWorld>>,
  clientCount: number
): Promise<void> {
  for (let i = 0; i < clientCount; i++) {
    await world.addClient({ id: `c${i}` });
  }
}

/**
 * Room system: draws `clientCount` and `mildFaults`, boots one kit world,
 * and returns {@link RoomSurface}.
 */
export function defineRoomSystem(
  app: RoomApp,
  opts?: DefineRoomSystemOpts
): RoomSystemDef {
  return defineSystem({
    name: opts?.name ?? 'room',
    async *generate(session) {
      const clientCount = yield* draw(gen(fc.integer({ min: 0, max: 4 })));
      const mildFaults = yield* draw(gen(fc.boolean()));
      const world = await createRoomWorld({
        session,
        module: app.module,
        mildFaults,
        ...(opts?.topic !== undefined ? { topic: opts.topic } : {}),
        ...(opts?.storage !== undefined ? { storage: opts.storage } : {}),
        ...(app.authorize !== undefined ? { authorize: app.authorize } : {}),
      });
      await bootClients(world, clientCount);
      return {
        session,
        app,
        world,
        clients: world.clients,
        server: world.server,
      } satisfies RoomSurface;
    },
  });
}

export type { RoomSurface };
export { WORLD_START_MS };
