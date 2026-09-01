import {
  defineNodeKind,
  type JsonValue,
  type KnobCatalog,
} from '@pkgs/determinism';

import { wrapSimNetwork } from '../network';
import { bootSimInfra, bootSimServer } from '../world-boot';
import { buildWorldFacade } from '../world-facade';
import type { WorldClientOpts } from '../world-types';
import {
  requireFacade,
  requireInfra,
  type SyncSystem,
  type SyncSystemFacade,
} from './system';

function worldArgsFromKnobs(
  system: SyncSystem,
  knobs: KnobCatalog<Record<string, JsonValue>>
): WorldClientOpts {
  return {
    domain: system.app.pack,
    rowImageFanout: knobs.get('rowImageFanout') === true,
    liveResendOnReconnect: knobs.get('liveResendOnReconnect') === true,
    bufferOutboundLive: knobs.get('bufferOutboundLive') === true,
    ...(system.sessionQuery !== undefined
      ? { sessionQuery: system.sessionQuery }
      : {}),
    ...(system.localSchema !== undefined
      ? { localSchema: system.localSchema }
      : {}),
    ...(system.mutationRegistry !== undefined
      ? { mutationRegistry: system.mutationRegistry }
      : {}),
    ...(system.queryRegistry !== undefined
      ? { queryRegistry: system.queryRegistry }
      : {}),
  };
}

/** Wrap the framework network kernel, then boot clock-skew table + broker. */
export const SYNC_BROKER = defineNodeKind<
  { readonly id: string },
  unknown,
  SyncSystem
>({
  id: 'sync.broker',
  boot: (ctx) => {
    const system = ctx.state;
    const worldArgs = worldArgsFromKnobs(system, ctx.knobs);
    system.worldArgs = worldArgs;
    system.infra = bootSimInfra({
      worldArgs,
      injected: {
        deps: ctx.deps,
        network: wrapSimNetwork(ctx.network),
      },
    });
    return { id: ctx.nodeId };
  },
});

/** In-memory SQLite server + HTTP bind, then the World facade. */
export const SYNC_SERVER = defineNodeKind<
  { readonly facade: SyncSystemFacade },
  unknown,
  SyncSystem
>({
  id: 'sync.server',
  boot: async (ctx) => {
    const system = ctx.state;
    const { infra, worldArgs } = requireInfra(system);
    const kernel = await bootSimServer({ infra, worldArgs });
    system.kernel = kernel;
    const facade = buildWorldFacade(kernel);
    system.facade = facade;
    return { facade };
  },
  dispose: async (handle) => {
    await handle.facade.dispose();
  },
});

export const SYNC_CLIENT = defineNodeKind<
  { readonly id: string },
  unknown,
  SyncSystem
>({
  id: 'sync.client',
  boot: async (ctx) => {
    await requireFacade(ctx.state).addClient({
      id: ctx.nodeId,
      actorId: ctx.nodeId,
    });
    return { id: ctx.nodeId };
  },
});
