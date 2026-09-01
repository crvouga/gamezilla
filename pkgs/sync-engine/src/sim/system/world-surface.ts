import type { SimClientHandle } from '../client-handle';
import type { InvariantViolation } from '../invariants';
import type { SimNetHandle } from '../net-effect';
import type { SimNetwork } from '../network';
import type { SimNodeHandle } from '../node-handle';
import type { SeededRng } from '../rng';
import type { SimServer } from '../server';
import type { LocalStorageTamper } from '../storage-faults';
import type { StoragePressureKind } from '../storage-pressure';
import type { SimTraffic } from '../traffic';
import type { NeverOpts, UntilOpts, UntilTarget } from '../until';
import type { AddClientArgs } from '../world-types';

/**
 * Scripted-pin / dispatch surface — structural subset of kit {@link World}.
 * Kept separate so `sim/system/*` does not import `world-api` (no cycles).
 */
export type SystemWorldSurface = {
  readonly seed: bigint;
  readonly rng: SeededRng;
  readonly clients: ReadonlyMap<string, SimClientHandle>;
  readonly server: SimServer;
  readonly network: SimNetwork;
  readonly net: (nodeId: string, traffic?: SimTraffic) => SimNetHandle;
  readonly node: (id: string) => SimNodeHandle;
  readonly runFor: (ms: number) => Promise<void>;
  readonly until: (target: UntilTarget, opts?: UntilOpts) => Promise<number>;
  readonly never: (target: UntilTarget, opts: NeverOpts) => Promise<void>;
  readonly pendingEventCount: () => number;
  readonly isSchedulerQuiescent: () => boolean;
  readonly checkInvariants: () => Promise<InvariantViolation | null>;
  readonly assertConverged: () => Promise<void>;
  readonly clearBoundaryFaults: () => void;
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
  readonly addClient: (args: AddClientArgs) => Promise<SimClientHandle>;
  readonly brokerCrash: () => void;
  readonly brokerRestart: () => Promise<void>;
};
