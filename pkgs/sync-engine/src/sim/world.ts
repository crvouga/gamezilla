import { untilAll, untilAny } from './until';
import type { OpenWorldArgs, World } from './world-api';
import { bootSimKernel } from './world-boot';
import { buildWorldFacade } from './world-facade';
import type { WorldClientOpts } from './world-types';

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

function toWorldClientOpts(args: OpenWorldArgs): WorldClientOpts {
  return {
    domain: args.domain,
    ...(args.faults !== undefined ? { faults: args.faults } : {}),
    ...(args.sampleFaults !== undefined
      ? { sampleFaults: args.sampleFaults }
      : {}),
    ...(args.rowImageFanout !== undefined
      ? { rowImageFanout: args.rowImageFanout }
      : {}),
    ...(args.liveResendOnReconnect !== undefined
      ? { liveResendOnReconnect: args.liveResendOnReconnect }
      : {}),
    ...(args.bufferOutboundLive !== undefined
      ? { bufferOutboundLive: args.bufferOutboundLive }
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
}

/**
 * Multi-client deterministic sync world: virtual clock, lossy network,
 * in-memory SQLite server + clients running real createLocalSyncEngine.
 * Scripted scenarios add clients with `addClient`; DST worlds come from
 * `defineSyncDst` + `openDstWorld` instead.
 */
export async function openWorld(args: OpenWorldArgs): Promise<World> {
  const kernel = await bootSimKernel({
    seed: args.seed,
    worldArgs: toWorldClientOpts(args),
  });
  return buildWorldFacade(kernel);
}
