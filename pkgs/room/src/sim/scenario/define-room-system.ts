import { defineSystem, type System, virtualHost } from '@pkgs/dst';
import type { InMemoryRoomStorage } from '../../server/adapters/memory';
import { createRoomKit } from '../kit';
import type { RoomApp } from './app';
import { ROOM_ARGS, ROOM_DRAW, type RoomArgs } from './args';
import type { RoomSurface } from './surface';

const SIM_START_MS = 1_700_000_000_000;

export type DefineRoomSystemOpts = {
  readonly name?: string;
  readonly topic?: string;
  readonly storage?: InMemoryRoomStorage;
};

export type RoomSystemDef = System<RoomSurface, RoomArgs>;

async function bootClients(
  kit: Awaited<ReturnType<typeof createRoomKit>>,
  clientCount: number
): Promise<void> {
  for (let i = 0; i < clientCount; i++) {
    await kit.addClient({ id: `c${i}` });
  }
}

/**
 * Room system: boots one kit from typed args and returns {@link RoomSurface}.
 */
export function defineRoomSystem(
  app: RoomApp,
  opts?: DefineRoomSystemOpts
): RoomSystemDef {
  const system = defineSystem({
    name: opts?.name ?? 'room',
    args: ROOM_ARGS,
    draw: ROOM_DRAW,
    async create(session, args: RoomArgs) {
      const kit = await createRoomKit({
        session,
        module: app.module,
        mildFaults: args.mildFaults,
        ...(opts?.topic !== undefined ? { topic: opts.topic } : {}),
        ...(opts?.storage !== undefined ? { storage: opts.storage } : {}),
        ...(app.authorize !== undefined ? { authorize: app.authorize } : {}),
      });
      await bootClients(kit, args.clientCount);
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

  system.host({
    default: true,
    name: 'virtual',
    create: () => virtualHost({ startTime: SIM_START_MS }),
  });

  return system;
}

export type { RoomArgs, RoomSurface };
export { SIM_START_MS };
