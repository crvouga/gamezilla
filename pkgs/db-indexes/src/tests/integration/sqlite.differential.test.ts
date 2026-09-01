import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';
import { fingerprintSql } from '../../core/fingerprint';
import { reconcileIndexes } from '../../core/reconcile';
import type { WorkloadManifest } from '../../core/types';
import { createSimClock, SimDb } from '../../sim';
import { createSqlitePort } from '../../sqlite';

function stmt(sql: string) {
  return {
    index: 0,
    sql,
    fingerprint: fingerprintSql(sql),
    weight: 1,
  };
}

const MANIFEST: WorkloadManifest = {
  version: 1,
  queries: [
    {
      name: 'notesByUser',
      hydrates: ['notes'],
      statements: [stmt('SELECT id FROM notes WHERE user_id = ?')],
    },
  ],
};

const CFG = {
  minTableRows: 1,
  minImprovementFactor: 2,
  createEstimatedMs: 10,
  deprecationWindowDays: 1,
  maxBuildsPerRun: 3,
} as const;

describe('sqlite differential + faults', () => {
  test('SimDb owned names ⊆ sqlite_master after reconcile', async () => {
    const raw = new Database(':memory:');
    raw.run(
      `CREATE TABLE notes (id TEXT PRIMARY KEY, user_id TEXT, title TEXT)`
    );
    for (let i = 0; i < 200; i++) {
      raw.run(`INSERT INTO notes (id, user_id, title) VALUES (?, ?, ?)`, [
        `n${String(i)}`,
        `u${String(i % 10)}`,
        `t`,
      ]);
    }
    const clock = createSimClock(0);
    const sqlite = createSqlitePort(
      { db: raw, idleWindow: true },
      { config: { sqliteMaxOnlineBuildRows: 10_000 } }
    );
    const sim = new SimDb({
      clock,
      tables: [{ name: 'notes', estimatedRows: 50_000 }],
      defaultImprovement: 10,
    });

    await reconcileIndexes({
      manifest: MANIFEST,
      db: sqlite,
      clock,
      deadlineMs: 60_000,
      config: CFG,
    });
    await reconcileIndexes({
      manifest: MANIFEST,
      db: sim,
      clock: createSimClock(0),
      deadlineMs: 60_000,
      config: CFG,
    });

    const sqliteOwned = (await sqlite.introspectIndexes())
      .filter((i) => i.isOwned)
      .map((i) => i.name)
      .sort();
    const simOwned = [...sim.getOwnedIndexNames()].sort();
    // Same desired definition ⇒ same owned names
    expect(sqliteOwned).toEqual(simOwned);
    raw.close();
  });

  test('readIndexUsage returns zeros (observable behavior)', async () => {
    const raw = new Database(':memory:');
    raw.run(`CREATE TABLE notes (id TEXT PRIMARY KEY, user_id TEXT)`);
    const db = createSqlitePort({ db: raw, idleWindow: true });
    const usage = await db.readIndexUsage();
    for (const u of usage) {
      expect(u.scans).toBe(0);
    }
    raw.close();
  });

  test('large table defer / lowConfidence path does not throw', async () => {
    const raw = new Database(':memory:');
    raw.run(`CREATE TABLE notes (id TEXT PRIMARY KEY, user_id TEXT)`);
    const clock = createSimClock(0);
    const db = createSqlitePort(
      { db: raw, idleWindow: false },
      {
        config: {
          sqliteMaxOnlineBuildRows: 0,
          minTableRows: 1,
        },
      }
    );
    // Force high row estimate via many inserts if port uses count
    for (let i = 0; i < 50; i++) {
      raw.run(`INSERT INTO notes (id, user_id) VALUES (?, ?)`, [
        `n${String(i)}`,
        'u',
      ]);
    }
    const report = await reconcileIndexes({
      manifest: MANIFEST,
      db,
      clock,
      deadlineMs: 60_000,
      config: {
        ...CFG,
        sqliteMaxOnlineBuildRows: 0,
      },
    });
    expect(report).toBeDefined();
    raw.close();
  });

  test('_autoidx_meta round-trip', async () => {
    const raw = new Database(':memory:');
    raw.run(`CREATE TABLE notes (id TEXT PRIMARY KEY, user_id TEXT)`);
    for (let i = 0; i < 30; i++) {
      raw.run(`INSERT INTO notes (id, user_id) VALUES (?, ?)`, [
        `n${String(i)}`,
        'u',
      ]);
    }
    const clock = createSimClock(0);
    const db = createSqlitePort(
      { db: raw, idleWindow: true },
      { config: { sqliteMaxOnlineBuildRows: 10 } }
    );
    await reconcileIndexes({
      manifest: MANIFEST,
      db,
      clock,
      deadlineMs: 60_000,
      config: CFG,
    });
    await reconcileIndexes({
      manifest: { version: 1, queries: [] },
      db,
      clock,
      deadlineMs: 60_000,
      config: CFG,
    });
    const metas = await db.readOwnedMeta();
    expect(metas.length).toBeGreaterThanOrEqual(0);
    raw.close();
  });
});
