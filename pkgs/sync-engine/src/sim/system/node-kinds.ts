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

export const SYNC_BROKER = 'sync.broker';
export const SYNC_SERVER = 'sync.server';
export const SYNC_CLIENT = 'sync.client';
export const SYNC_WARMUP = 'sync.warmup';

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
defineNodeKind<{ readonly id: string }, unknown, SyncSystem>({
  id: SYNC_BROKER,
  boot: (ctx) => {
    const system = ctx.system;
    const worldArgs = worldArgsFromKnobs(system, ctx.knobs);
    system.worldArgs = worldArgs;
    system.infra = bootSimInfra({
      seed: ctx.deps.seed,
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
defineNodeKind<{ readonly facade: SyncSystemFacade }, unknown, SyncSystem>({
  id: SYNC_SERVER,
  boot: async (ctx) => {
    const system = ctx.system;
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

defineNodeKind<{ readonly id: string }, unknown, SyncSystem>({
  id: SYNC_CLIENT,
  boot: async (ctx) => {
    await requireFacade(ctx.system).addClient({
      id: ctx.nodeId,
      actorId: ctx.nodeId,
    });
    return { id: ctx.nodeId };
  },
});

/**
 * Post-topology settle window so clients finish initial hydration before the
 * first generated action lands (the old `bootClients` tail).
 */
defineNodeKind<{ readonly id: string }, unknown, SyncSystem>({
  id: SYNC_WARMUP,
  boot: async (ctx) => {
    await requireFacade(ctx.system).runFor(200);
    return { id: ctx.nodeId };
  },
});
