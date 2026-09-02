import { type JsonValue, type KnobDef, node } from '@pkgs/determinism';

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

export function createSyncNodes(runtime: SyncRuntime) {
  const broker = node({
    boot: (ctx) => {
      const worldArgs = worldArgsFromKnobs(runtime, ctx.knob);
      runtime.worldArgs = worldArgs;
      runtime.infra = bootSimInfra({
        worldArgs,
        injected: {
          deps: ctx.deps,
          network: wrapSimNetwork(ctx.network),
        },
      });
      return { id: ctx.id };
    },
  });

  const server = node({
    boot: async (ctx) => {
      const { infra, worldArgs } = requireInfra(runtime);
      const kernel = await bootSimServer({ infra, worldArgs });
      runtime.kernel = kernel;
      runtime.kit = buildWorldFacade(kernel);
      return { id: ctx.id };
    },
    dispose: async () => {
      await runtime.kit?.dispose();
    },
  });

  const client = {
    ...node({
      boot: async (ctx) => {
        await requireKit(runtime).addClient({
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
