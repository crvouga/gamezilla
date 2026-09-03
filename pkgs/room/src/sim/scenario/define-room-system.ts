import { defineSystem, draw, type System } from '@pkgs/dst';
import { gen } from '@pkgs/dst/fast-check';
import fc from 'fast-check';
import type { InMemoryRoomStorage } from '../../server/adapters/memory';
import { createRoomKit } from '../kit';
import type { RoomApp } from './app';
import type { RoomSurface } from './surface';

const SIM_START_MS = 1_700_000_000_000;

export type DefineRoomSystemOpts = {
  readonly name?: string;
  readonly topic?: string;
  readonly storage?: InMemoryRoomStorage;
};

export type RoomSystemDef = System<RoomSurface>;

async function bootClients(
  kit: Awaited<ReturnType<typeof createRoomKit>>,
  clientCount: number
): Promise<void> {
  for (let i = 0; i < clientCount; i++) {
    await kit.addClient({ id: `c${i}` });
  }
}

/**
 * Room system: draws `clientCount` and `mildFaults`, boots one kit,
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
      const kit = await createRoomKit({
        session,
        module: app.module,
        mildFaults,
        ...(opts?.topic !== undefined ? { topic: opts.topic } : {}),
        ...(opts?.storage !== undefined ? { storage: opts.storage } : {}),
        ...(app.authorize !== undefined ? { authorize: app.authorize } : {}),
      });
      await bootClients(kit, clientCount);
      return {
        session,
        app,
        kit,
        clients: kit.clients,
        server: kit.server,
      } satisfies RoomSurface;
    },
  });
}

export type { RoomSurface };
export { SIM_START_MS };
