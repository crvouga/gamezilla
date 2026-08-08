import { untilAll, untilAny } from './until';
import type { OpenSimWorldArgs, SimWorld } from './world-api';
import { bootSimKernel } from './world-boot';
import { buildSimWorldFacade } from './world-facade';

export type {
  SimCrashEvent,
  SimHttpFault,
} from './boundary-faults';
export type { SimAuthStatus } from './client-factory';
export type { SimDomainPack } from './domain-pack';
export type { NetEffect, NetState, SimNetHandle } from './net-effect';
export type { SimNodeHandle } from './node-handle';
export type { SimTraffic } from './traffic';
export type { NeverOpts, UntilOpts, UntilTarget } from './until';
export type { OpenSimWorldArgs, SimWorld } from './world-api';
export type { RestartClientOpts } from './world-lifecycle';
/** Optional combinators — not core scenario concepts. */
export { untilAll, untilAny };

/**
 * Multi-client deterministic sync world: virtual clock, lossy network,
 * in-memory SQLite server + clients running real createLocalSyncEngine.
 */
export async function openSimWorld(args: OpenSimWorldArgs): Promise<SimWorld> {
  const k = await bootSimKernel({ seed: args.seed, worldArgs: args });
  return buildSimWorldFacade(k);
}
