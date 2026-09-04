import type { VirtualScheduler } from '@pkgs/sim';
import type { InvariantViolation } from './invariants';
import type { SimNet } from './net-effect';
import type { SyncNetwork } from './network';
import type { SeededRng } from './rng';
import type { SimServer } from './server';
import type { SimClient } from './sim-client';
import type { SimNode } from './sim-node';
import type { AddClientArgs } from './sim-types';
import type { LocalStorageTamper } from './storage-faults';
import type { StoragePressureKind } from './storage-pressure';
import type { SimTraffic } from './traffic';

/** Internal kit surface wired by sync.server node boot — not the merged DST surface. */
export type SyncSimRuntime = {
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
  readonly clients: ReadonlyMap<string, SimClient>;
  readonly nextId: () => string;
  readonly addClient: (args: AddClientArgs) => Promise<SimClient>;
  readonly net: (nodeId: string, traffic?: SimTraffic) => SimNet;
  readonly node: (id: string) => SimNode;
  readonly isSchedulerQuiescent: () => boolean;
  readonly pendingEventCount: () => number;
  readonly checkInvariants: () => Promise<InvariantViolation | null>;
  /** Heal network / infra / reconnect clients — stimulus only. */
  readonly recoverAll: () => Promise<void>;
  /** Drain until domain agreement (no restoreNetwork — call recoverAll first). */
  readonly drainUntilInSync: () => Promise<void>;
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
  readonly clearEdgeFaults: () => void;
  readonly dispose: () => Promise<void>;
  readonly [Symbol.asyncDispose]: () => Promise<void>;
};
