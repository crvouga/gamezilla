import type { SimDomainPack } from './domain-pack';
import type { WorldKnobs } from './dst/knobs';
import { bootClients } from './replay-steps';
import { untilAll, untilAny } from './until';
import type { OpenWorldArgs, World } from './world-api';
import { bootSimKernel } from './world-boot';
import { buildWorldFacade } from './world-facade';

export type {
  SimCrashEvent,
  SimHttpFault,
} from './boundary-faults';
export type { SimAuthStatus } from './client-factory';
export type { SimDomainPack } from './domain-pack';
export type { DstAction, DstApp, WorldKnobs } from './dst';
export { arbWorldKnobs, arbWorldSeed } from './dst';
export type { NetEffect, NetState, SimNetHandle } from './net-effect';
export type { SimNodeHandle } from './node-handle';
export type { SimTraffic } from './traffic';
export type { NeverOpts, UntilOpts, UntilTarget } from './until';
export type { OpenWorldArgs, World } from './world-api';
export type { RestartClientOpts } from './world-lifecycle';
/** Optional combinators — not core scenario concepts. */
export { untilAll, untilAny };

function resolveDomain(args: OpenWorldArgs): SimDomainPack {
  if (args.app !== undefined) {
    if (args.domain !== undefined && args.domain !== args.app.pack) {
      throw new Error('openWorld: domain and app.pack mismatch');
    }
    return args.app.pack;
  }
  if (args.domain === undefined) {
    throw new Error('openWorld requires domain or app');
  }
  return args.domain;
}

function resolveKnobs(args: OpenWorldArgs): WorldKnobs | null {
  if (args.knobs !== undefined) return args.knobs;
  if (args.app === undefined) return null;
  return {
    rowImageFanout: args.rowImageFanout ?? false,
    liveResendOnReconnect: args.liveResendOnReconnect ?? false,
    bufferOutboundLive: args.bufferOutboundLive ?? false,
    clientCount: args.clientCount ?? 2,
  };
}

/**
 * Multi-client deterministic sync world: virtual clock, lossy network,
 * in-memory SQLite server + clients running real createLocalSyncEngine.
 * Pass `app` for DST/PBT (boots clients + playActions / runCommands).
 */
export async function openWorld(args: OpenWorldArgs): Promise<World> {
  const domain = resolveDomain(args);
  const knobs = resolveKnobs(args);
  const worldArgs: import('./world-types').WorldClientOpts = {
    domain,
    ...(args.faults !== undefined ? { faults: args.faults } : {}),
    ...(args.sampleFaults !== undefined
      ? { sampleFaults: args.sampleFaults }
      : {}),
    ...((knobs?.rowImageFanout ?? args.rowImageFanout) !== undefined
      ? {
          rowImageFanout: (knobs?.rowImageFanout ?? args.rowImageFanout)!,
        }
      : {}),
    ...((knobs?.liveResendOnReconnect ?? args.liveResendOnReconnect) !==
    undefined
      ? {
          liveResendOnReconnect: (knobs?.liveResendOnReconnect ??
            args.liveResendOnReconnect)!,
        }
      : {}),
    ...((knobs?.bufferOutboundLive ?? args.bufferOutboundLive) !== undefined
      ? {
          bufferOutboundLive: (knobs?.bufferOutboundLive ??
            args.bufferOutboundLive)!,
        }
      : {}),
    ...(args.localSchema !== undefined
      ? { localSchema: args.localSchema }
      : {}),
    ...(args.mutationRegistry !== undefined
      ? { mutationRegistry: args.mutationRegistry }
      : {}),
    ...(args.queryRegistry !== undefined
      ? { queryRegistry: args.queryRegistry }
      : {}),
    ...(args.sessionQuery !== undefined
      ? { sessionQuery: args.sessionQuery }
      : {}),
  };
  const k = await bootSimKernel({
    seed: args.seed,
    worldArgs,
  });
  const facadeOpts: import('./world-facade').BuildWorldFacadeOpts = {
    ...(args.app !== undefined ? { dstApp: args.app } : {}),
    ...(knobs !== null ? { knobs } : {}),
  };
  const world = buildWorldFacade(k, facadeOpts);
  if (args.app !== undefined) {
    const clientCount = knobs?.clientCount ?? args.clientCount ?? 2;
    const ids = await bootClients({
      world,
      clientCount,
      sampleFaults: false,
    });
    (world.clientIds as string[]).splice(0, world.clientIds.length, ...ids);
  }
  return world;
}
