import { type JsonValue, type KnobDef, node, type WorldPorts } from '@pkgs/dst';

import { wrapSimNetwork } from '../network';
import { bootSimInfra, bootSimServer } from '../world-boot';
import { buildWorldFacade } from '../world-facade';
import type { WorldClientOpts } from '../world-types';
import {
  BUFFER_OUTBOUND_LIVE,
  CLIENT_COUNT,
  LIVE_RESEND_ON_RECONNECT,
  ROW_IMAGE_FANOUT,
} from './knobs';
import { requireInfra, requireKit, type SyncRuntime } from './system';

type SyncServerHandle = {
  readonly id: string;
  readonly kit: NonNullable<SyncRuntime['kit']>;
  readonly runtime: SyncRuntime;
};

function worldArgsFromKnobs(
  runtime: SyncRuntime,
  knob: <T extends JsonValue>(def: KnobDef<T>) => T
): WorldClientOpts {
  return {
    domain: runtime.app.pack,
    rowImageFanout: knob(ROW_IMAGE_FANOUT),
    liveResendOnReconnect: knob(LIVE_RESEND_ON_RECONNECT),
    bufferOutboundLive: knob(BUFFER_OUTBOUND_LIVE),
    ...(runtime.sessionQuery !== undefined
      ? { sessionQuery: runtime.sessionQuery }
      : {}),
    ...(runtime.localSchema !== undefined
      ? { localSchema: runtime.localSchema }
      : {}),
    ...(runtime.mutationRegistry !== undefined
      ? { mutationRegistry: runtime.mutationRegistry }
      : {}),
    ...(runtime.queryRegistry !== undefined
      ? { queryRegistry: runtime.queryRegistry }
      : {}),
  };
}

export function createSyncNodes(
  runtimeOf: (ports: WorldPorts) => SyncRuntime
) {
  const broker = node({
    start: (ctx) => {
      const runtime = runtimeOf(ctx.ports);
      const worldArgs = worldArgsFromKnobs(runtime, ctx.knob);
      runtime.worldArgs = worldArgs;
      runtime.infra = bootSimInfra({
        worldArgs,
        injected: {
          deps: ctx.ports,
          network: wrapSimNetwork(ctx.network),
        },
      });
      return { id: ctx.id };
    },
  });

  const server = node({
    start: async (ctx) => {
      const runtime = runtimeOf(ctx.ports);
      const { infra, worldArgs } = requireInfra(runtime);
      const kernel = await bootSimServer({ infra, worldArgs });
      runtime.kernel = kernel;
      const kit = buildWorldFacade(kernel);
      runtime.kit = kit;
      return { id: ctx.id, kit, runtime } satisfies SyncServerHandle;
    },
    stop: async (handle: SyncServerHandle) => {
      await handle.kit.dispose();
      if (handle.runtime.kit === handle.kit) {
        handle.runtime.kit = null;
      }
    },
  });

  const client = {
    ...node({
      start: async (ctx) => {
        await requireKit(runtimeOf(ctx.ports)).addClient({
          id: ctx.id,
          actorId: ctx.id,
        });
        return { id: ctx.id };
      },
    }),
    count: (knobs: Record<string, JsonValue>) => knobs['clientCount'] as number,
    id: (index: number) => `c${index}`,
  };

  return { broker, server, client } as const;
}

export { CLIENT_COUNT, ROW_IMAGE_FANOUT };
