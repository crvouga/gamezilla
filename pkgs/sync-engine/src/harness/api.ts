import type { VirtualScheduler } from '@pkgs/harness';
import type { HarnessClient } from './client';
import type { InvariantViolation } from './invariants';
import type { HarnessNet } from './net-effect';
import type { SyncNetwork } from './network';
import type { HarnessNode } from './node';
import type { SeededRng } from './rng';
import type { HarnessServer } from './server';
import type { LocalStorageTamper } from './storage-faults';
import type { StoragePressureKind } from './storage-pressure';
import type { HarnessTraffic } from './traffic';
import type { AddClientArgs } from './types';

/** Internal kit surface wired by sync.server node boot — not the merged DST surface. */
export type SyncHarnessRuntime = {
  readonly seed: bigint;
  /** @internal Lab / harness */
  readonly clock: { now(): number };
  /** @internal Lab / fuzz */
  readonly rng: SeededRng;
  /** @internal Lab / harness */
  readonly scheduler: VirtualScheduler;
  /** @internal Lab / harness */
  readonly network: SyncNetwork;
  readonly server: HarnessServer;
  readonly clients: ReadonlyMap<string, HarnessClient>;
  readonly nextId: () => string;
  readonly addClient: (args: AddClientArgs) => Promise<HarnessClient>;
  readonly net: (nodeId: string, traffic?: HarnessTraffic) => HarnessNet;
  readonly node: (id: string) => HarnessNode;
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
