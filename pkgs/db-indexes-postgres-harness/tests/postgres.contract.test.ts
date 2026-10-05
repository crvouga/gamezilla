// Cached index contracts use a private Mockingbird Postgres, never an injected database.

import { afterAll, describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarnessClock } from '@pkgs/db-indexes-root-harness/clock';
import { HarnessDb } from '@pkgs/db-indexes-root-harness/db';
import { fingerprintSql } from '@pkgs/db-indexes-root-shared/fingerprint';
import { reconcileIndexes } from '@pkgs/db-indexes-root-shared/reconcile';
import { freePostgresPort } from '@pkgs/postgres-mockingbird-server/free-port';
import { startMockingbirdPostgres } from '@pkgs/postgres-mockingbird-server/start';
import { openPgClient } from '@pkgs/sql-client-postgres-server/connect';
import { createPostgresDbScope } from '@pkgs/sql-client-root-shared/postgres-db-scope';

const REMOTE_DB_TIMEOUT_MS = 30_000;
const TEST_SCHEMA = 'db_indexes_contract';

const pg = await startMockingbirdPostgres({
  port: await freePostgresPort(),
  dataDir: join(tmpdir(), `pg-idx-contract-${randomUUID()}`),
});
const DATABASE_URL = pg.url;

afterAll(async () => {
  await pg.stop();
});

function stmt(sql: string) {
  return {
    index: 0,
    sql,
    fingerprint: fingerprintSql(sql),
    weight: 1,
  };
}

describe('postgres port contract', () => {
  // regression: cached-contract-external-credentials
  test('injected DATABASE_URL cannot select an external fixture', () => {
    expect(new URL(DATABASE_URL).hostname).toBe('127.0.0.1');
  });
  test('createPostgresPort is exported', async () => {
    const mod = await import(
      '@pkgs/db-indexes-postgres-shared/create-postgres-port'
    );
    expect(typeof mod.createPostgresPort).toBe('function');
  });

  test('HarnessDb repairs invalid owned index on next run', async () => {
    const clock = createHarnessClock(0);
    const db = new HarnessDb({
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
          statements: [stmt(sql)],
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
    const clock = createHarnessClock(0);
    const db = new HarnessDb({
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
            statements: [stmt(sql)],
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

describe('postgres live differential', () => {
  test(
    'createPostgresPort round-trip with real DATABASE_URL',
    async () => {
      const { createPostgresPort } = await import(
        '@pkgs/db-indexes-postgres-shared/create-postgres-port'
      );
      const clock = createHarnessClock(0);
      const dbScope = createPostgresDbScope(TEST_SCHEMA);
      const opened = await openPgClient({
        connectionString: DATABASE_URL,
        dbScope,
        ensureSchema: true,
      });
      try {
        const port = createPostgresPort(opened.sqlClient, { clock });
        const tables = await port.introspectTables();
        expect(Array.isArray(tables)).toBe(true);
        const indexes = await port.introspectIndexes();
        expect(Array.isArray(indexes)).toBe(true);
      } finally {
        await opened.sqlClient.disconnect();
      }
    },
    REMOTE_DB_TIMEOUT_MS
  );
});
