import { defineNodeKind } from '@pkgs/determinism';

import { MILD_ROOM_FAULTS, wrapRoomNetwork } from '../network';
import { bootRoomKitWorld } from '../world';
import type { World } from '../world-api';
import { type RoomSystem, requireWorld } from './system';

/** Wrap the framework network kernel, then boot the room server + world. */
export const roomServerNode = defineNodeKind<
  { readonly world: World },
  unknown,
  RoomSystem
>({
  id: 'room.server',
  boot: async (ctx) => {
    const state = ctx.state;
    const mildFaults = ctx.knobs.get('mildFaults') === true;
    const network = wrapRoomNetwork({
      kernel: ctx.network,
      scheduler: ctx.deps.scheduler,
      ...(mildFaults ? { faults: MILD_ROOM_FAULTS } : {}),
    });
    const world = await bootRoomKitWorld({
      seed: ctx.deps.seed,
      module: state.app.module,
      ...(state.app.authorize !== undefined
        ? { authorize: state.app.authorize }
        : {}),
      injected: { deps: ctx.deps, network },
    });
    state.world = world;
    return { world };
  },
  dispose: async (handle) => {
    await handle.world.dispose();
  },
});

export const roomClientNode = defineNodeKind<
  { readonly id: string },
  unknown,
  RoomSystem
>({
  id: 'room.client',
  boot: async (ctx) => {
    await requireWorld(ctx.state).addClient({
      id: ctx.nodeId,
      identity: ctx.nodeId,
      clientId: ctx.nodeId,
    });
    return { id: ctx.nodeId };
  },
});
