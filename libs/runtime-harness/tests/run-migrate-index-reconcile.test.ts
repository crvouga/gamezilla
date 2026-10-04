import { describe, expect, test } from 'bun:test';
import { fingerprintSql } from '@pkgs/db-indexes-shared/fingerprint';
import { createHarnessClock } from '@pkgs/db-indexes-harness/clock';
import { HarnessDb } from '@pkgs/db-indexes-harness/db';
import { createLogger } from '@pkgs/logger-shared/logger';
import { runMigrateIndexReconcile } from '@libs/runtime-server/run-migrate-index-reconcile';

function silentLogger() {
  return createLogger({ name: 'test:autoidx', level: 'silent', now: () => 0 });
}

function manifestFor(sql: string) {
  return {
    version: 1 as const,
    queries: [
      {
        name: 'q',
        hydrates: ['notes'],
        statements: [
          { index: 0, sql, fingerprint: fingerprintSql(sql), weight: 1 },
        ],
      },
    ],
  };
}

describe('runMigrateIndexReconcile', () => {
  test('creates desired owned indexes on empty tables', async () => {
    const clock = createHarnessClock(0);
    const db = new HarnessDb({
      clock,
      tables: [{ name: 'notes', estimatedRows: 0 }],
      defaultImprovement: 1,
    });
    await runMigrateIndexReconcile({
      manifest: manifestFor('SELECT id FROM notes WHERE user_id = ?'),
      db,
      clock,
      logger: silentLogger(),
      deadlineMs: 60_000,
    });
    const indexes = await db.introspectIndexes();
    expect(
      indexes.some((i) => i.isOwned && i.name.startsWith('autoidx_'))
    ).toBe(true);
  });

  test('throws when execute returns failed', async () => {
    const clock = createHarnessClock(0);
    const db = new HarnessDb({
      clock,
      tables: [{ name: 'notes', estimatedRows: 0 }],
      defaultImprovement: 1,
    });
    const original = db.execute.bind(db);
    db.execute = async (action, deadline) => {
      if (action.kind === 'create') {
        return { status: 'failed', reason: 'disk full' };
      }
      return original(action, deadline);
    };
    await expect(
      runMigrateIndexReconcile({
        manifest: manifestFor('SELECT id FROM notes WHERE user_id = ?'),
        db,
        clock,
        logger: silentLogger(),
        deadlineMs: 60_000,
      })
    ).rejects.toThrow(/autoidx reconcile failed/);
  });
});
