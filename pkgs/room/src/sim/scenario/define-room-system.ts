import { defineSystem, type System, virtualHost } from '@pkgs/dst';
import type { InMemoryRoomStorage } from '../../server/adapters/memory';
import { createRoomKit } from '../kit';
import type { RoomApp } from './app';
import type { RoomKnobs } from './knobs';
import type { RoomSurface } from './surface';

const SIM_START_MS = 1_700_000_000_000;

/** Default virtual host for room `script` / `explore` call sites. */
export function roomVirtualHost(startTime: number = SIM_START_MS) {
  return virtualHost({ startTime });
}

export type DefineRoomSystemOpts = {
  readonly name?: string;
  readonly topic?: string;
  readonly storage?: InMemoryRoomStorage;
};

export type RoomSystemDef = System<RoomSurface, RoomKnobs>;

async function bootClients(
  kit: Awaited<ReturnType<typeof createRoomKit>>,
  clientCount: number
): Promise<void> {
  for (let i = 0; i < clientCount; i++) {
    await kit.addClient({ id: `c${i}` });
  }
}

/**
 * Room system: boots one kit from typed knobs and returns {@link RoomSurface}.
 */
export function defineRoomSystem(
  app: RoomApp,
  opts?: DefineRoomSystemOpts
): RoomSystemDef {
  return defineSystem({
    name: opts?.name ?? 'room',
    async generate(session, knobs: RoomKnobs) {
      const kit = await createRoomKit({
        session,
        module: app.module,
        mildFaults: knobs.mildFaults,
        ...(opts?.topic !== undefined ? { topic: opts.topic } : {}),
        ...(opts?.storage !== undefined ? { storage: opts.storage } : {}),
        ...(app.authorize !== undefined ? { authorize: app.authorize } : {}),
      });
      await bootClients(kit, knobs.clientCount);
      // Room loopback / aux IO settles via kit.drain — not bare scheduler.settle.
      const mutable = session as {
        settle: () => Promise<void>;
      };
      mutable.settle = () => kit.drain();
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
