import { defineNodeKind } from '@pkgs/dst';

import { MILD_ROOM_FAULTS, wrapDstRoomNetwork } from '../network';
import { openWorld } from '../world';
import type { World } from '../world-api';
import { type RoomDstSystem, requireWorld } from './system';

export const ROOM_SERVER = 'room.server';
export const ROOM_CLIENT = 'room.client';

/** Wrap the framework network kernel, then boot the room server + world. */
defineNodeKind<{ readonly world: World }, unknown, RoomDstSystem>({
  id: ROOM_SERVER,
  boot: async (ctx) => {
    const system = ctx.system;
    const mildFaults = ctx.knobs.get('mildFaults') === true;
    const network = wrapDstRoomNetwork({
      kernel: ctx.network,
      scheduler: ctx.deps.scheduler,
      ...(mildFaults ? { faults: MILD_ROOM_FAULTS } : {}),
    });
    const world = await openWorld({
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

defineNodeKind<{ readonly id: string }, unknown, RoomDstSystem>({
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
