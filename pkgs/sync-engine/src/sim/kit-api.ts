import type { VirtualScheduler } from '@pkgs/dst/kernel';

import type { SimClientHandle } from './client-handle';
import type { InvariantViolation } from './invariants';
import type { AddClientArgs } from './kit-types';
import type { SimNetHandle } from './net-effect';
import type { SyncNetwork } from './network';
import type { SimNodeHandle } from './node-handle';
import type { SeededRng } from './rng';
import type { SimServer } from './server';
import type { LocalStorageTamper } from './storage-faults';
import type { StoragePressureKind } from './storage-pressure';
import type { SimTraffic } from './traffic';

/** Internal kit surface wired by sync.server node boot — not the merged DST surface. */
export type SyncKit = {
  readonly seed: bigint;
  /** @internal Lab / harness */
  readonly clock: { now(): number };
  /** @internal Lab / fuzz */
  readonly rng: SeededRng;
  /** @internal Lab / harness */
  readonly scheduler: VirtualScheduler;
  /** @internal Lab / harness */
  readonly network: SyncNetwork;
  readonly server: SimServer;
  readonly clients: ReadonlyMap<string, SimClientHandle>;
  readonly nextId: () => string;
  readonly addClient: (args: AddClientArgs) => Promise<SimClientHandle>;
  readonly net: (nodeId: string, traffic?: SimTraffic) => SimNetHandle;
  readonly node: (id: string) => SimNodeHandle;
  readonly isSchedulerQuiescent: () => boolean;
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
  readonly clearBoundaryFaults: () => void;
  readonly dispose: () => Promise<void>;
  readonly [Symbol.asyncDispose]: () => Promise<void>;
};
