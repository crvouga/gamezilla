import type { SimClock, SimScheduler } from '@pkgs/determinism';

import type { SimClientHandle } from './client-handle';
import type { InvariantViolation } from './invariants';
import type { SimNetHandle } from './net-effect';
import type { SimNetwork } from './network';
import type { SimNodeHandle } from './node-handle';
import type { SeededRng } from './rng';
import type { SimServer } from './server';
import type { LocalStorageTamper } from './storage-faults';
import type { StoragePressureKind } from './storage-pressure';
import type { SimTraffic } from './traffic';
import type { NeverOpts, UntilOpts, UntilTarget } from './until';
import type { AddClientArgs } from './world-types';

export type World = {
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
  readonly armStoragePressure: (
    clientId: string,
    kind: StoragePressureKind,
    afterStatements?: number
  ) => void;
  readonly clearStoragePressure: (clientId?: string) => void;
  readonly armFailNextOpen: (clientId: string) => void;
  readonly clearFailNextOpen: (clientId?: string) => void;
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
