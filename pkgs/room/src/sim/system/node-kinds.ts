import { defineNodeKind } from '@pkgs/determinism';

import { MILD_ROOM_FAULTS, wrapRoomNetwork } from '../network';
import { bootRoomKitWorld } from '../world';
import type { World } from '../world-api';
import { type RoomSystem, requireWorld } from './system';

export const ROOM_SERVER = 'room.server';
export const ROOM_CLIENT = 'room.client';

/** Wrap the framework network kernel, then boot the room server + world. */
defineNodeKind<{ readonly world: World }, unknown, RoomSystem>({
  id: ROOM_SERVER,
  boot: async (ctx) => {
    const system = ctx.system;
    const mildFaults = ctx.knobs.get('mildFaults') === true;
    const network = wrapRoomNetwork({
      kernel: ctx.network,
      scheduler: ctx.deps.scheduler,
      ...(mildFaults ? { faults: MILD_ROOM_FAULTS } : {}),
    });
    const world = await bootRoomKitWorld({
      seed: ctx.deps.seed,
      module: system.app.module,
      ...(system.app.authorize !== undefined
        ? { authorize: system.app.authorize }
        : {}),
      injected: { deps: ctx.deps, network },
    });
    system.world = world;
    return { world };
  },
  dispose: async (handle) => {
    await handle.world.dispose();
  },
});

defineNodeKind<{ readonly id: string }, unknown, RoomSystem>({
  id: ROOM_CLIENT,
  boot: async (ctx) => {
    await requireWorld(ctx.system).addClient({
      id: ctx.nodeId,
      identity: ctx.nodeId,
      clientId: ctx.nodeId,
    });
    return { id: ctx.nodeId };
  },
});
