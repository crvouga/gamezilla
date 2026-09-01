import { defineNodeKind } from '@pkgs/determinism';
import { fingerprintSql } from '../../core/fingerprint';
import { createSimClock, SimDb } from '../../sim';
import type { IndexesSystem } from './types';

const SEED_SQL = 'SELECT id FROM notes WHERE user_id = ?';

/**
 * Single reconciler peer holding SimDb + sim clock.
 */
export const indexesReconcilerNode = defineNodeKind<
  IndexesSystem,
  IndexesSystem,
  IndexesSystem
>({
  id: 'indexes.reconciler',
  boot: async (ctx) => {
    const clock = createSimClock(0);
    const db = new SimDb({
      clock,
      tables: [
        { name: 'notes', estimatedRows: 50_000 },
        { name: 'users', estimatedRows: 50_000 },
      ],
      defaultImprovement: 10,
    });
    ctx.state.clock = clock;
    ctx.state.db = db;
    ctx.state.tables = ['notes', 'users'];
    ctx.state.maxPerTable = 6;
    ctx.state.manifest = {
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
    };
    return ctx.state;
  },
  dispose: async () => {
    // in-memory
  },
});
