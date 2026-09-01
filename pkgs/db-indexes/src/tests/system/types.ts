import type { Clock } from '@pkgs/clock';
import type { ReconcileReport, WorkloadManifest } from '../../core/types';
import type { createSimClock } from '../../sim/sim-clock';
import type { SimDb } from '../../sim/sim-db';

export type IndexesSystem = {
  db: SimDb;
  clock: ReturnType<typeof createSimClock>;
  manifest: WorkloadManifest;
  lastReport: ReconcileReport | null;
  lastCrash: boolean;
  tables: readonly string[];
  maxPerTable: number;
};

export type IndexesModel = {
  cycleCount: number;
};

export function createIndexesSystem(): IndexesSystem {
  // Filled by reconciler node boot
  return {
    db: null as unknown as SimDb,
    clock: null as unknown as ReturnType<typeof createSimClock>,
    manifest: { version: 1, queries: [] },
    lastReport: null,
    lastCrash: false,
    tables: ['notes', 'users'],
    maxPerTable: 6,
  };
}

export type { Clock };
