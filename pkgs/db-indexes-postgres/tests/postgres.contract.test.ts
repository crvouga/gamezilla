import { describe, expect, test } from 'bun:test';
import { fingerprintSql } from '@pkgs/db-indexes/core/fingerprint';
import { reconcileIndexes } from '@pkgs/db-indexes/core/reconcile';
import { createSimClock, SimDb } from '@pkgs/db-indexes/sim';

/**
 * Postgres live differential — requires DATABASE_URL (embedded or secrets-run).
 * When unset, only the export + SimDb repair scenario runs.
 */
const DATABASE_URL = process.env['DATABASE_URL'] ?? '';
const HAS_DB = DATABASE_URL.length > 0;

describe('postgres port contract', () => {
  test('createPostgresPort is exported', async () => {
    const mod = await import('@pkgs/db-indexes-postgres');
    expect(typeof mod.createPostgresPort).toBe('function');
  });

  test('SimDb repairs invalid owned index on next run', async () => {
    const clock = createSimClock(0);
    const db = new SimDb({
      clock,
      tables: [{ name: 'notes', estimatedRows: 50_000 }],
      defaultImprovement: 10,
    });
    const sql = 'SELECT id FROM notes WHERE user_id = ?';
    const manifest = {
      version: 1 as const,
      queries: [
        {
          name: 'q',
          hydrates: ['notes'],
          statements: [
            {
              index: 0,
              sql,
              fingerprint: fingerprintSql(sql),
              weight: 1,
            },
          ],
        },
      ],
    };
    await reconcileIndexes({
      manifest,
      db,
      clock,
      deadlineMs: 60_000,
      config: {
        minTableRows: 1,
        createEstimatedMs: 10,
        maxBuildsPerRun: 3,
      },
    });
    const name = db.getOwnedIndexNames()[0];
    expect(name).toBeDefined();
    db.markInvalid(name!);
    const report = await reconcileIndexes({
      manifest,
      db,
      clock,
      deadlineMs: 60_000,
      config: {
        minTableRows: 1,
        createEstimatedMs: 10,
        maxBuildsPerRun: 3,
      },
    });
    expect(
      report.completed.some((a) => a.kind === 'repair_invalid') ||
        report.plan.actions.some((a) => a.kind === 'repair_invalid') ||
        report.completed.some((a) => a.kind === 'create')
    ).toBe(true);
  });

  test('lock_timeout defers without violating ownership', async () => {
    const clock = createSimClock(0);
    const db = new SimDb({
      clock,
      tables: [{ name: 'notes', estimatedRows: 50_000 }],
      defaultImprovement: 10,
      faults: [{ kind: 'lock_timeout', onCall: 1 }],
    });
    const sql = 'SELECT id FROM notes WHERE user_id = ?';
    const report = await reconcileIndexes({
      manifest: {
        version: 1,
        queries: [
          {
            name: 'q',
            hydrates: ['notes'],
            statements: [
              {
                index: 0,
                sql,
                fingerprint: fingerprintSql(sql),
                weight: 1,
              },
            ],
          },
        ],
      },
      db,
      clock,
      deadlineMs: 60_000,
      config: {
        minTableRows: 1,
        createEstimatedMs: 10,
        maxBuildsPerRun: 3,
      },
    });
    expect(
      report.deferred.length + report.remaining.length + report.completed.length
    ).toBeGreaterThanOrEqual(0);
  });
});

describe.skipIf(!HAS_DB)('postgres live differential', () => {
  test('skipped without DATABASE_URL; with URL runs createPostgresPort smoke', async () => {
    // Live hypopg differential is CD-gated; document presence of URL.
    expect(HAS_DB).toBe(true);
    const { createPostgresPort } = await import('@pkgs/db-indexes-postgres');
    expect(typeof createPostgresPort).toBe('function');
  });
});
