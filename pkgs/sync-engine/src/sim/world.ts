import type { LocalDomainSchema } from '../client/local-schema-migrate';
import type { MutationRegistry } from '../mutations/core/types';
import type { QueryRegistry } from '../queries/core/types';
import type { SimClientHandle } from './client-factory';
import type { SimClock } from './clock';
import type { SimDomainPack } from './domain-pack';
import type { SimFaultOptions } from './faults';
import type { InvariantViolation } from './invariants';
import type { SimNetHandle } from './net-effect';
import type { SimNetwork } from './network';
import type { SimNodeHandle } from './node-handle';
import type { SeededRng } from './rng';
import type { SimScheduler } from './scheduler';
import type { SimServer } from './server';
import type { SimTraffic } from './traffic';
import type { UntilOpts, UntilTarget } from './until';
import { untilAll, untilAny } from './until';
import { bootSimKernel } from './world-boot';
import { buildSimWorldFacade } from './world-facade';
import type { AddClientArgs } from './world-types';

export type {
  SimCrashEvent,
  SimHttpFault,
} from './boundary-faults';
export type { SimAuthStatus } from './client-factory';
export type { SimDomainPack } from './domain-pack';
export type { NetEffect, NetState, SimNetHandle } from './net-effect';
export type { SimNodeHandle } from './node-handle';
export type { SimTraffic } from './traffic';
export type { UntilOpts, UntilTarget } from './until';
export type { RestartClientOpts } from './world-lifecycle';
export { untilAll, untilAny };

export type SimWorld = {
  readonly seed: bigint;
  readonly clock: SimClock;
  /** @internal Lab / fuzz */
  readonly rng: SeededRng;
  /** @internal Lab / harness */
  readonly scheduler: SimScheduler;
  /** @internal Lab / harness */
  readonly network: SimNetwork;
  readonly server: SimServer;
  readonly clients: ReadonlyMap<string, SimClientHandle>;
  readonly nextId: () => string;
  readonly addClient: (args: AddClientArgs) => Promise<SimClientHandle>;
  readonly net: (nodeId: string, traffic?: SimTraffic) => SimNetHandle;
  readonly node: (id: string) => SimNodeHandle;
  readonly until: (target: UntilTarget, opts?: UntilOpts) => Promise<number>;
  readonly runFor: (ms: number) => Promise<void>;
  readonly runUntilIdle: (opts?: {
    readonly maxSteps?: number;
    readonly maxVirtualMs?: number;
  }) => Promise<void>;
  readonly isSchedulerQuiescent: () => boolean;
  readonly checkInvariants: () => Promise<InvariantViolation | null>;
  readonly assertConverged: () => Promise<void>;
  readonly dispose: () => Promise<void>;
  readonly [Symbol.asyncDispose]: () => Promise<void>;
};

export type OpenSimWorldArgs = {
  readonly seed: number | bigint | string;
  readonly faults?: SimFaultOptions;
  readonly sampleFaults?: boolean;
  readonly rowImageFanout?: boolean;
  readonly liveResendOnReconnect?: boolean;
  readonly bufferOutboundLive?: boolean;
  readonly domain: SimDomainPack;
  readonly localSchema?: LocalDomainSchema;
  readonly mutationRegistry?: MutationRegistry;
  readonly queryRegistry?: QueryRegistry;
  readonly sessionQuery?: {
    readonly name: string;
    readonly params: Readonly<Record<string, unknown>>;
  };
};

/**
 * Multi-client deterministic sync world: virtual clock, lossy network,
 * in-memory SQLite server + clients running real createLocalSyncEngine.
 */
export async function openSimWorld(args: OpenSimWorldArgs): Promise<SimWorld> {
  const k = await bootSimKernel({ seed: args.seed, worldArgs: args });
  return buildSimWorldFacade(k);
}
