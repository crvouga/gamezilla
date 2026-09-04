import type { SimNet } from '../net-effect';
import type { SyncNetwork } from '../network';
import type { SeededRng } from '../rng';
import type { SimServer } from '../server';
import type { SimClient } from '../sim-client';
import type { SimNode } from '../sim-node';
import type { AddClientArgs } from '../sim-types';
import type { LocalStorageTamper } from '../storage-faults';
import type { StoragePressureKind } from '../storage-pressure';
import type { SimTraffic } from '../traffic';

/**
 * Scripted-pin / dispatch surface — domain ops over the live sync surface.
 * Waiting / converge / invariants are reads + `s.until` / properties — not
 * methods on this surface.
 */
export type SyncSimBase = {
  readonly seed: bigint;
  readonly rng: SeededRng;
  readonly clients: ReadonlyMap<string, SimClient>;
  readonly server: SimServer;
  readonly kit: { readonly network: SyncNetwork };
  readonly net: (nodeId: string, traffic?: SimTraffic) => SimNet;
  readonly node: (id: string) => SimNode;
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
  readonly addClient: (args: AddClientArgs) => Promise<SimClient>;
  readonly brokerCrash: () => void;
  readonly brokerRestart: () => Promise<void>;
  /** Role → node ids (`client` → live clients, `server` → `['server']`). */
  readonly nodeIds: (role: string) => readonly string[];
};
