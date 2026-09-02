import { describe, expect, test } from 'bun:test';
import { fingerprintSql } from '../../core/fingerprint';
import { reconcileIndexes } from '../../core/reconcile';
import type { WorkloadManifest } from '../../core/types';
import { createSimClock, SimDb } from '../../sim';
import {
  checkInvariantsAsync,
  createRng,
  faultScheduleFromSeed,
  runHarness,
} from '../../sim/harness';

function stmt(sql: string) {
  return {
    index: 0,
    sql,
    fingerprint: fingerprintSql(sql),
    weight: 1,
  };
}

describe('DST harness', () => {
  test('seed replay is byte-identical', async () => {
    const seed = 42;
    async function once() {
      const clock = createSimClock(0);
      const db = new SimDb({
        clock,
        tables: [
          { name: 'notes', estimatedRows: 50_000 },
          { name: 'users', estimatedRows: 50_000 },
        ],
        defaultImprovement: 10,
        faults: faultScheduleFromSeed(seed),
      });
      return runHarness({
        seed,
        db,
        clock,
        tables: ['notes', 'users'],
        cycles: 4,
      });
    }
    const a = await once();
    const b = await once();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.violations.length).toBe(0);
  });

  test('fixpoint after enough fault-free runs', async () => {
    const clock = createSimClock(0);
    const db = new SimDb({
      clock,
      tables: [{ name: 'notes', estimatedRows: 50_000 }],
      defaultImprovement: 10,
    });
    const manifest: WorkloadManifest = {
      version: 1,
      queries: [
        {
          name: 'notesByUser',
          hydrates: ['notes'],
          statements: [stmt('SELECT id FROM notes WHERE user_id = ?')],
        },
      ],
    };
    const cfg = {
      minTableRows: 1,
      createEstimatedMs: 10,
      maxBuildsPerRun: 3,
    } as const;
    await reconcileIndexes({
      manifest,
      db,
      clock,
      deadlineMs: 60_000,
      config: cfg,
    });
    const report = await reconcileIndexes({
      manifest,
      db,
      clock,
      deadlineMs: 60_000,
      config: cfg,
    });
    expect(report.plan.actions.length).toBe(0);
    const v = await checkInvariantsAsync(db, 6);
    expect(v.length).toBe(0);
  });

  test('usage since deprecation never drops', async () => {
    const clock = createSimClock(0);
    const db = new SimDb({
      clock,
      tables: [{ name: 'notes', estimatedRows: 50_000 }],
      defaultImprovement: 10,
    });
    const createManifest: WorkloadManifest = {
      version: 1,
      queries: [
        {
          name: 'notesByUser',
          hydrates: ['notes'],
          statements: [stmt('SELECT id FROM notes WHERE user_id = ?')],
        },
      ],
    };
    await reconcileIndexes({
      manifest: createManifest,
      db,
      clock,
      deadlineMs: 60_000,
      config: {
        minTableRows: 1,
        createEstimatedMs: 10,
        deprecationWindowDays: 1,
      },
    });
    const names = db.getOwnedIndexNames();
    expect(names.length).toBe(1);
    const indexName = names[0]!;

    // Empty manifest → deprecate
    const empty: WorkloadManifest = { version: 1, queries: [] };
    await reconcileIndexes({
      manifest: empty,
      db,
      clock,
      deadlineMs: 60_000,
      config: {
        minTableRows: 1,
        createEstimatedMs: 10,
        deprecationWindowDays: 1,
      },
    });

    // Usage appears
    db.bumpScans(indexName, 5);
    clock.advance(2 * 24 * 60 * 60 * 1000);

    await reconcileIndexes({
      manifest: empty,
      db,
      clock,
      deadlineMs: 60_000,
      config: {
        minTableRows: 1,
        createEstimatedMs: 10,
        deprecationWindowDays: 1,
      },
    });
    expect(db.getOwnedIndexNames()).toContain(indexName);
  });

  test('many seeds produce no invariant violations', async () => {
    const rng = createRng(7);
    for (let i = 0; i < 20; i++) {
      const seed = Math.floor(rng.next() * 1_000_000);
      const clock = createSimClock(0);
      const db = new SimDb({
        clock,
        tables: [
          { name: 'notes', estimatedRows: 50_000 },
          { name: 'users', estimatedRows: 50_000 },
        ],
        defaultImprovement: 10,
      });
      const result = await runHarness({
        seed,
        db,
        clock,
        tables: ['notes', 'users'],
        cycles: 3,
      });
      expect(result.violations).toEqual([]);
    }
  });
});
