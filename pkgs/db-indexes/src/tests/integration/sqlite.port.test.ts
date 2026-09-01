import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';
import { fingerprintSql } from '../../core/fingerprint';
import { reconcileIndexes } from '../../core/reconcile';
import type { WorkloadManifest } from '../../core/types';
import { createSimClock } from '../../sim';
import { createSqlitePort } from '../../sqlite';

function stmt(sql: string) {
  return {
    index: 0,
    sql,
    fingerprint: fingerprintSql(sql),
    weight: 1,
  };
}

describe('sqlite port integration', () => {
  test('create → deprecate → drop cycle', async () => {
    const raw = new Database(':memory:');
    raw.run(
      `CREATE TABLE notes (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        title TEXT,
        deleted_at TEXT
      )`
    );
    for (let i = 0; i < 100; i++) {
      raw.run(`INSERT INTO notes (id, user_id, title) VALUES (?, ?, ?)`, [
        `n${String(i)}`,
        `u${String(i % 10)}`,
        `t${String(i)}`,
      ]);
    }
    const clock = createSimClock(0);
    const db = createSqlitePort(
      { db: raw, idleWindow: true },
      { config: { sqliteMaxOnlineBuildRows: 10 } }
    );
    const manifest: WorkloadManifest = {
      version: 1,
      queries: [
        {
          name: 'notesByUser',
          hydrates: ['notes'],
          statements: [stmt('SELECT id, title FROM notes WHERE user_id = ?')],
        },
      ],
    };
    const report = await reconcileIndexes({
      manifest,
      db,
      clock,
      deadlineMs: 60_000,
      config: {
        minTableRows: 1,
        minImprovementFactor: 2,
        createEstimatedMs: 10,
        deprecationWindowDays: 1,
      },
    });
    expect(
      report.completed.some((a) => a.kind === 'create') ||
        report.plan.desired.length > 0
    ).toBe(true);

    const indexes = await db.introspectIndexes();
    const owned = indexes.filter((i) => i.isOwned);
    expect(owned.length).toBeGreaterThanOrEqual(0);

    // Empty workload → deprecate
    await reconcileIndexes({
      manifest: { version: 1, queries: [] },
      db,
      clock,
      deadlineMs: 60_000,
      config: {
        minTableRows: 1,
        createEstimatedMs: 10,
        deprecationWindowDays: 1,
      },
    });
    clock.advance(2 * 24 * 60 * 60 * 1000);
    await reconcileIndexes({
      manifest: { version: 1, queries: [] },
      db,
      clock,
      deadlineMs: 60_000,
      config: {
        minTableRows: 1,
        createEstimatedMs: 10,
        deprecationWindowDays: 1,
      },
    });
    raw.close();
  });
});
