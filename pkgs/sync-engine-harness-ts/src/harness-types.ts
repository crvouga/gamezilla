import type { SeededRng } from '@pkgs/uuid-shared-ts/seeded-rng';
import type { HarnessClient } from './client';
import type { HarnessNet } from './net-effect';
import type { SyncNetwork } from './network';
import type { HarnessNode } from './node';
import type { HarnessServer } from './server';
import type { LocalStorageTamper } from './storage-faults';
import type { StoragePressureKind } from './storage-pressure';
import type { HarnessTraffic } from './traffic';
import type { AddClientArgs } from './types';

/**
 * Scripted-pin / dispatch surface — domain ops over the live sync surface.
 * Waiting / converge / invariants are reads + `s.until` / properties — not
 * methods on this surface.
 */
export type SyncHarnessBase = {
  readonly seed: bigint;
  readonly rng: SeededRng;
  readonly clients: ReadonlyMap<string, HarnessClient>;
  readonly server: HarnessServer;
  readonly kit: { readonly network: SyncNetwork };
  readonly net: (nodeId: string, traffic?: HarnessTraffic) => HarnessNet;
  readonly node: (id: string) => HarnessNode;
  readonly advance: (ms: number) => Promise<void>;
  readonly pendingEventCount: () => number;
  readonly isSchedulerQuiescent: () => boolean;
  /** Heal network / infra / reconnect clients — stimulus only. */
  readonly recoverAll: () => Promise<void>;
  readonly clearEdgeFaults: () => void;
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
  readonly addClient: (args: AddClientArgs) => Promise<HarnessClient>;
  readonly brokerCrash: () => void;
  readonly brokerRestart: () => Promise<void>;
  /** Role → node ids (`client` → live clients, `server` → `['server']`). */
  readonly nodeIds: (role: string) => readonly string[];
};
