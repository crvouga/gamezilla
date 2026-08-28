import type { LocalDomainSchema } from '../client/local-schema-migrate';
import type { MutationRegistry } from '../mutations/core/types';
import type { QueryRegistry } from '../queries/core/types';
import type { SimClientHandle } from './client-handle';
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
import type { LocalStorageTamper } from './storage-faults';
import type { SimTraffic } from './traffic';
import type { NeverOpts, UntilOpts, UntilTarget } from './until';
import type { AddClientArgs } from './world-types';

export type SimWorld = {
  readonly seed: bigint;
  /** @internal Lab / harness */
  readonly clock: SimClock;
  /** @internal Lab / fuzz */
  readonly rng: SeededRng;
  /** @internal Lab / harness — scenarios use isSchedulerQuiescent */
  readonly scheduler: SimScheduler;
  /** @internal Lab / harness — scenarios use net() */
  readonly network: SimNetwork;
  readonly server: SimServer;
  readonly clients: ReadonlyMap<string, SimClientHandle>;
  readonly nextId: () => string;
  readonly addClient: (args: AddClientArgs) => Promise<SimClientHandle>;
  readonly net: (nodeId: string, traffic?: SimTraffic) => SimNetHandle;
  readonly node: (id: string) => SimNodeHandle;
  readonly until: (target: UntilTarget, opts?: UntilOpts) => Promise<number>;
  /** Fail if target becomes true within forMs (scheduler-driven). */
  readonly never: (target: UntilTarget, opts: NeverOpts) => Promise<void>;
  readonly runFor: (ms: number) => Promise<void>;
  /** @internal Lab / harness — banned in scenarios */
  readonly runUntilIdle: (opts?: {
    readonly maxSteps?: number;
    readonly maxVirtualMs?: number;
  }) => Promise<void>;
  readonly isSchedulerQuiescent: () => boolean;
  /** Boundary observable — replaces scenario reach into world.scheduler. */
  readonly pendingEventCount: () => number;
  readonly checkInvariants: () => Promise<InvariantViolation | null>;
  readonly assertConverged: () => Promise<void>;
  readonly tamperLocalStorage: (
    clientId: string,
    tamper: LocalStorageTamper
  ) => Promise<void>;
  readonly brokerCrash: () => void;
  readonly brokerRestart: () => Promise<void>;
  /**
   * Drop armed crash / HTTP / pubsub / publish faults. Settle and DST
   * converge prep call this so leftover one-shots cannot fire on heal
   * restarts (e.g. revoke → fresh DB migrate + onNextEngineOpenAfterCacheWipe).
   */
  readonly clearBoundaryFaults: () => void;
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
