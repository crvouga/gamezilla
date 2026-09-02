import { type JsonValue, node } from '@pkgs/determinism';

import { MILD_ROOM_FAULTS, wrapRoomNetwork } from '../network';
import { bootRoomKitWorld } from '../world';
import type { World } from '../world-api';
import type { RoomApp } from './app';
import { MILD_FAULTS } from './knobs';
import { type RoomRuntime, requireKit } from './system';

type RoomServerHandle = { readonly id: string; readonly kit: World };

export function createRoomNodes(runtime: RoomRuntime, app: RoomApp) {
  const server = node({
    boot: async (ctx) => {
      const mildFaults = ctx.knob(MILD_FAULTS) === true;
      const network = wrapRoomNetwork({
        kernel: ctx.network,
        scheduler: ctx.deps.scheduler,
        ...(mildFaults ? { faults: MILD_ROOM_FAULTS } : {}),
      });
      const kit = await bootRoomKitWorld({
        seed: ctx.deps.seed,
        module: app.module,
        ...(app.authorize !== undefined ? { authorize: app.authorize } : {}),
        ...(runtime.topic !== undefined ? { topic: runtime.topic } : {}),
        ...(runtime.storage !== undefined ? { storage: runtime.storage } : {}),
        injected: { deps: ctx.deps, network },
      });
      runtime.kit = kit;
      return { id: ctx.id, kit } satisfies RoomServerHandle;
    },
    dispose: async (handle: RoomServerHandle) => {
      await handle.kit.dispose();
      if (runtime.kit === handle.kit) {
        runtime.kit = null;
      }
    },
  });

  const client = {
    ...node({
      boot: async (ctx) => {
        await requireKit(runtime).addClient({
          id: ctx.id,
          identity: ctx.id,
          clientId: ctx.id,
        });
        return { id: ctx.id };
      },
    }),
    count: (knobs: Record<string, JsonValue>) => knobs['clientCount'] as number,
    id: (index: number) => `c${index}`,
  };

  return { server, client } as const;
}

export { MILD_FAULTS };
