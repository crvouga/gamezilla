import { node } from '@pkgs/dst';
import { fingerprintSql } from '../../core/fingerprint';
import type { ReconcileReport, WorkloadManifest } from '../../core/types';
import { createSimClock, SimDb } from '../../sim';

const SEED_SQL = 'SELECT id FROM notes WHERE user_id = ?';

export type IndexesReconcilerHandle = {
  db: SimDb;
  clock: ReturnType<typeof createSimClock>;
  manifest: WorkloadManifest;
  lastReport: ReconcileReport | null;
  lastCrash: boolean;
  readonly tables: readonly string[];
  readonly maxPerTable: number;
};

/**
 * Single reconciler peer holding SimDb + sim clock.
 */
export const indexesReconcilerNode = node({
  start: async () => {
    const clock = createSimClock(0);
    const db = new SimDb({
      clock,
      tables: [
        { name: 'notes', estimatedRows: 50_000 },
        { name: 'users', estimatedRows: 50_000 },
      ],
      defaultImprovement: 10,
    });
    return {
      db,
      clock,
      manifest: {
        version: 1,
        queries: [
          {
            name: 'notesByUser',
            hydrates: ['notes'],
            statements: [
              {
                index: 0,
                sql: SEED_SQL,
                fingerprint: fingerprintSql(SEED_SQL),
                weight: 1,
              },
            ],
          },
        ],
      },
      lastReport: null,
      lastCrash: false,
      tables: ['notes', 'users'],
      maxPerTable: 6,
    } satisfies IndexesReconcilerHandle;
  },
  stop: async () => {
    // in-memory
  },
});
