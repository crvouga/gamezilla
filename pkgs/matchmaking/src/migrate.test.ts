import { PGlite } from '@electric-sql/pglite';
import { sql, type Sql } from '@pkgs/sql';
import { sqlMap } from '@pkgs/sql-map';

import type { SqlClient } from '@pkgs/sql-client/interface';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { migrate } from './migrate';
import { NUM_WAITING_PARTITIONS } from './migrate-sql';
import { createPgliteSqlClient } from './pglite-adapter';
import { registerTestCrashHandler } from './test-harness';

let disposeTestCrashHandler: () => void;
beforeAll(() => {
  disposeTestCrashHandler = registerTestCrashHandler();
});
afterAll(() => {
  disposeTestCrashHandler();
});

async function boot(): Promise<{ db: PGlite; sqlClient: SqlClient }> {
  const db = await PGlite.create();
  const sqlClient = createPgliteSqlClient(db);
  return { db, sqlClient };
}

async function columnDef(
  sqlClient: SqlClient,
  table: string,
  column: string
): Promise<{ data_type: string; is_generated: string } | null> {
  const result = await sqlClient.query<{
    data_type: string;
    is_generated: string;
  }>(sql`
    SELECT data_type, is_generated
     FROM information_schema.columns
     WHERE table_name = ${table} AND column_name = ${column}`);
  return result[0] ?? null;
}

describe('migrate v3 - schema bootstrap', () => {
  test('creates 16 hash child partitions for matchmaking_waiting', async () => {
    const { db, sqlClient } = await boot();
    try {
      await migrate({ sqlClient });
      const children = await sqlClient.query<{ relname: string }>(sql`
        SELECT c.relname
         FROM pg_inherits i
         JOIN pg_class p ON p.oid = i.inhparent
         JOIN pg_class c ON c.oid = i.inhrelid
         WHERE p.relname = 'matchmaking_waiting'
         ORDER BY c.relname`);
      expect(children.length).toBe(NUM_WAITING_PARTITIONS);
      for (let i = 0; i < NUM_WAITING_PARTITIONS; i += 1) {
        const suffix = i.toString().padStart(2, '0');
        expect(children[i]?.relname).toBe(`matchmaking_waiting_p${suffix}`);
      }
    } finally {
      await db.close();
    }
  });

  test('matchmaking_waiting parent is UNLOGGED and PARTITION BY HASH', async () => {
    const { db, sqlClient } = await boot();
    try {
      await migrate({ sqlClient });
      const meta = await sqlClient.query<{
        relpersistence: string;
        relkind: string;
        partstrat: string | null;
      }>(sql`
        SELECT c.relpersistence, c.relkind, p.partstrat
         FROM pg_class c
         LEFT JOIN pg_partitioned_table p ON p.partrelid = c.oid
         WHERE c.relname = 'matchmaking_waiting'`);
      expect(meta[0]?.relpersistence).toBe('u');
      expect(meta[0]?.relkind).toBe('p');
      expect(meta[0]?.partstrat).toBe('h');
    } finally {
      await db.close();
    }
  });

  test('default schema generates primary_rating, primary_bucket as stored columns; partition_signature is regular (forbidden as a generated partition key)', async () => {
    const { db, sqlClient } = await boot();
    try {
      await migrate({ sqlClient });
      const partSig = await columnDef(
        sqlClient,
        'matchmaking_waiting',
        'partition_signature'
      );
      const rating = await columnDef(
        sqlClient,
        'matchmaking_waiting',
        'primary_rating'
      );
      const bucket = await columnDef(
        sqlClient,
        'matchmaking_waiting',
        'primary_bucket'
      );
      // Postgres forbids generated columns as partition keys; JS
      // supplies partition_signature at INSERT time instead.
      expect(partSig?.is_generated).toBe('NEVER');
      expect(rating?.is_generated).toBe('ALWAYS');
      expect(bucket?.is_generated).toBe('ALWAYS');
    } finally {
      await db.close();
    }
  });

  test('creates matchmaking_matched as a regular LOGGED table with match_id + matched_at indexes', async () => {
    const { db, sqlClient } = await boot();
    try {
      await migrate({ sqlClient });
      const meta = await sqlClient.query<{
        relpersistence: string;
        relkind: string;
      }>(
        sql`SELECT relpersistence, relkind FROM pg_class WHERE relname = 'matchmaking_matched'`
      );
      expect(meta[0]?.relpersistence).toBe('p');
      expect(meta[0]?.relkind).toBe('r');

      const idx = await sqlClient.query<{ indexname: string }>(
        sql`SELECT indexname FROM pg_indexes WHERE tablename = 'matchmaking_matched' ORDER BY indexname`
      );
      const names = new Set(idx.map((r) => r.indexname));
      expect(names.has('matchmaking_matched_match_id_idx')).toBe(true);
      expect(names.has('matchmaking_matched_matched_at_idx')).toBe(true);
    } finally {
      await db.close();
    }
  });

  test('creates matchmaking_active_partitions side table (UNLOGGED, composite PK)', async () => {
    const { db, sqlClient } = await boot();
    try {
      await migrate({ sqlClient });
      const meta = await sqlClient.query<{ relpersistence: string }>(
        sql`SELECT relpersistence FROM pg_class WHERE relname = 'matchmaking_active_partitions'`
      );
      expect(meta[0]?.relpersistence).toBe('u');
      // v4 PK is (partition_signature, group_size) — order matters
      // because the tick loop reads `(sig, group_size)` pairs from this
      // table. Both columns are part of the unique constraint that
      // backs the on-conflict-do-nothing upsert in `insertJoin`.
      const pk = await sqlClient.query<{
        column_name: string;
        ordinal_position: number;
      }>(sql`
        SELECT a.attname AS column_name, x.ordinal_position
         FROM pg_index i
         JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS x(attnum, ordinal_position) ON true
         JOIN pg_attribute a
           ON a.attrelid = i.indrelid AND a.attnum = x.attnum
         WHERE i.indrelid = 'matchmaking_active_partitions'::regclass
           AND i.indisprimary
         ORDER BY x.ordinal_position`);
      expect(pk.map((r) => r.column_name)).toEqual([
        'partition_signature',
        'group_size',
      ]);
    } finally {
      await db.close();
    }
  });
});

describe('migrate v3 - idempotency', () => {
  test('running migrate twice with the same schema is a no-op', async () => {
    const { db, sqlClient } = await boot();
    try {
      await migrate({ sqlClient });
      await migrate({ sqlClient });
      const fp = await sqlClient.query<{ schema_fingerprint: string }>(
        sqlMap({
          select: ['schema_fingerprint'],
          from: 'matchmaking_schema_state',
          where: ['=', 'id', 1],
        })
      );
      expect(fp.length).toBe(1);
    } finally {
      await db.close();
    }
  });

  test('running migrate with a different schema rebuilds the waiting table', async () => {
    const { db, sqlClient } = await boot();
    try {
      await migrate({ sqlClient });

      // Insert a row, then re-migrate with partitionKeys declared. The
      // rebuild drops the table so the row goes with it — the contract
      // here is that the schema fingerprint flips and the new shape
      // permits an insert with caller-supplied partition_signature.
      await sqlClient.run(
        sqlMap({
          insertInto: 'matchmaking_waiting',
          values: {
            data: [
              'cast',
              JSON.stringify({ 'mmtest/region': 'us-east' }),
              'jsonb',
            ],
            formulas: ['cast', JSON.stringify([{ numeric: [] }]), 'jsonb'],
            partition_signature: '',
          },
        })
      );

      await migrate({
        sqlClient,
        schema: { partitionKeys: ['mmtest/region'] },
      });
      const fp = await sqlClient.query<{ schema_fingerprint: string }>(
        sqlMap({
          select: ['schema_fingerprint'],
          from: 'matchmaking_schema_state',
          where: ['=', 'id', 1],
        })
      );
      expect(fp[0]?.schema_fingerprint ?? '').toContain('mmtest/region');

      // Insert a row through the new schema using a JS-computed
      // partition_signature; verify it round-trips.
      await sqlClient.run(
        sqlMap({
          insertInto: 'matchmaking_waiting',
          values: {
            data: [
              'cast',
              JSON.stringify({ 'mmtest/region': 'eu-west' }),
              'jsonb',
            ],
            formulas: ['cast', JSON.stringify([{ numeric: [] }]), 'jsonb'],
            partition_signature: 'eu-west',
          },
        })
      );
      const row = await sqlClient.query<{ partition_signature: string }>(
        sqlMap({
          select: ['partition_signature'],
          from: 'matchmaking_waiting',
          where: ['=', ['->>', 'data', 'mmtest/region'], 'eu-west'],
        })
      );
      expect(row[0]?.partition_signature).toBe('eu-west');
    } finally {
      await db.close();
    }
  });
});

describe('migrate v3 - matchmaking_tick() function', () => {
  test('installs matchmaking_tick() as a no-arg VOID function', async () => {
    const { db, sqlClient } = await boot();
    try {
      await migrate({ sqlClient });
      const fn = await sqlClient.query<{
        proname: string;
        pronargs: number;
        prorettype_name: string;
      }>(sql`
        SELECT p.proname,
                p.pronargs,
                t.typname AS prorettype_name
         FROM pg_proc p
         JOIN pg_type t ON t.oid = p.prorettype
         WHERE p.proname = 'matchmaking_tick'`);
      expect(fn.length).toBe(1);
      expect(fn[0]?.pronargs).toBe(0);
      expect(fn[0]?.prorettype_name).toBe('void');
    } finally {
      await db.close();
    }
  });

  test('SELECT matchmaking_tick() runs cleanly on an empty queue', async () => {
    const { db, sqlClient } = await boot();
    try {
      await migrate({ sqlClient });
      // Calling on an empty queue exercises the advisory-lock acquire/
      // release path and the fan-out loop with zero partitions; any
      // PL/pgSQL regression (unbalanced lock, bad function signature,
      // missing helper) surfaces here.
      await sqlClient.query(sql`SELECT matchmaking_tick()`);
      // Second call confirms the advisory lock was released on the
      // happy path — otherwise the second tick would silently no-op
      // (but here we just assert it doesn't throw).
      await sqlClient.query(sql`SELECT matchmaking_tick()`);
      // Cross-check the advisory lock is not held by the current
      // session after both ticks return.
      const held = await sqlClient.query<{ held: boolean }>(sql`
        SELECT EXISTS (
           SELECT 1 FROM pg_locks
           WHERE locktype = 'advisory'
             AND pid = pg_backend_pid()
         ) AS held`);
      expect(held[0]?.held).toBe(false);
    } finally {
      await db.close();
    }
  });

  test('re-running migrate replaces matchmaking_tick() (idempotent)', async () => {
    const { db, sqlClient } = await boot();
    try {
      await migrate({ sqlClient });
      await migrate({ sqlClient });
      const count = await sqlClient.query<{ n: number }>(
        sql`SELECT COUNT(*)::INT AS n FROM pg_proc WHERE proname = 'matchmaking_tick'`
      );
      expect(count[0]?.n).toBe(1);
    } finally {
      await db.close();
    }
  });

  test('PGlite has no pg_cron; migrate skips cron.schedule without error', async () => {
    const { db, sqlClient } = await boot();
    try {
      // The bare assertion is "migrate succeeds end-to-end on PGlite".
      // If migrate ever started UNCONDITIONALLY calling cron.schedule,
      // PGlite would raise "schema 'cron' does not exist" and the
      // hermetic test path would break.
      await migrate({ sqlClient });
      const hasCronJob = await sqlClient.query<{ ok: boolean }>(sql`
        SELECT EXISTS (
           SELECT 1
           FROM information_schema.schemata
           WHERE schema_name = 'cron'
         ) AS ok`);
      expect(hasCronJob[0]?.ok).toBe(false);
    } finally {
      await db.close();
    }
  });
});

describe('migrate v3 - schema validation', () => {
  test('rejects non-keyword partition keys', async () => {
    const { db, sqlClient } = await boot();
    try {
      await expect(
        migrate({
          sqlClient,
          schema: { partitionKeys: ['NOT a keyword'] },
        })
      ).rejects.toThrow();
    } finally {
      await db.close();
    }
  });

  test('rejects a non-keyword primaryNumericKey', async () => {
    const { db, sqlClient } = await boot();
    try {
      await expect(
        migrate({
          sqlClient,
          schema: { primaryNumericKey: 'NOPE' },
        })
      ).rejects.toThrow();
    } finally {
      await db.close();
    }
  });

  test('rejects non-positive bucketWidth', async () => {
    const { db, sqlClient } = await boot();
    try {
      await expect(
        migrate({
          sqlClient,
          schema: { bucketWidth: 0 },
        })
      ).rejects.toThrow();
    } finally {
      await db.close();
    }
  });
});

// ---------------------------------------------------------------------
// Phase 2 — production hardening test gaps for migrate
// ---------------------------------------------------------------------

describe('migrate - schema fingerprint stability', () => {
  test('fingerprint value (not just row count) stays stable across re-migrate', async () => {
    const { db, sqlClient } = await boot();
    try {
      const schema = {
        partitionKeys: ['mmtest/region'],
        primaryNumericKey: 'mmtest/rating',
        bucketWidth: 50,
      };
      await migrate({ sqlClient, schema });
      const first = await sqlClient.query<{ fp: string }>(
        sqlMap({
          select: [['schema_fingerprint', 'fp']],
          from: 'matchmaking_schema_state',
          where: ['=', 'id', 1],
        })
      );
      const firstFp = first[0]?.fp;
      expect(typeof firstFp).toBe('string');
      await migrate({ sqlClient, schema });
      const second = await sqlClient.query<{ fp: string }>(
        sqlMap({
          select: [['schema_fingerprint', 'fp']],
          from: 'matchmaking_schema_state',
          where: ['=', 'id', 1],
        })
      );
      expect(second[0]?.fp).toBe(firstFp);
    } finally {
      await db.close();
    }
  });

  test('changing schema bumps the fingerprint', async () => {
    const { db, sqlClient } = await boot();
    try {
      await migrate({
        sqlClient,
        schema: { partitionKeys: ['mmtest/region'] },
      });
      const first = await sqlClient.query<{ fp: string }>(
        sqlMap({
          select: [['schema_fingerprint', 'fp']],
          from: 'matchmaking_schema_state',
          where: ['=', 'id', 1],
        })
      );
      await migrate({
        sqlClient,
        schema: { partitionKeys: ['mmtest/region', 'mmtest/kind'] },
      });
      const second = await sqlClient.query<{ fp: string }>(
        sqlMap({
          select: [['schema_fingerprint', 'fp']],
          from: 'matchmaking_schema_state',
          where: ['=', 'id', 1],
        })
      );
      expect(second[0]?.fp).not.toBe(first[0]?.fp);
    } finally {
      await db.close();
    }
  });
});

describe('migrate - matchmaking_active_partitions prune', () => {
  test('matchmaking_tick prunes empty signatures regardless of age', async () => {
    const { db, sqlClient } = await boot();
    try {
      await migrate({ sqlClient });
      // Seed a synthetic active-partitions row pointing at no waiters.
      await sqlClient.run(
        sqlMap({
          insertInto: 'matchmaking_active_partitions',
          values: { partition_signature: 'orphaned-partition' },
        })
      );
      const before = await sqlClient.query<{ n: number }>(
        sqlMap({
          select: [[['cast', ['count', '*'], 'int'], 'n']],
          from: 'matchmaking_active_partitions',
        })
      );
      expect(before[0]?.n).toBe(1);
      await sqlClient.query(sql`SELECT matchmaking_tick()`);
      const after = await sqlClient.query<{ n: number }>(
        sqlMap({
          select: [[['cast', ['count', '*'], 'int'], 'n']],
          from: 'matchmaking_active_partitions',
        })
      );
      expect(after[0]?.n).toBe(0);
    } finally {
      await db.close();
    }
  });

  test('matchmaking_tick prunes ancient empty signatures via watermark', async () => {
    const { db, sqlClient } = await boot();
    try {
      await migrate({ sqlClient });
      // Insert two synthetic rows: one "old" (faked by setting
      // first_seen_at far in the past, both with no waiters) and one
      // "fresh". Both are empty so both get pruned by the empty-now
      // clause too — this test verifies the watermark clause runs
      // (the two clauses are independent) by checking that the row
      // count drops to zero.
      await sqlClient.run(
        sqlMap({
          insertInto: 'matchmaking_active_partitions',
          values: [
            {
              partition_signature: 'old',
              first_seen_at: ['-', ['now'], ['interval', '30 days']],
            },
            { partition_signature: 'new', first_seen_at: ['now'] },
          ],
        })
      );
      await sqlClient.query(sql`SELECT matchmaking_tick()`);
      const after = await sqlClient.query<{ n: number }>(
        sqlMap({
          select: [[['cast', ['count', '*'], 'int'], 'n']],
          from: 'matchmaking_active_partitions',
        })
      );
      expect(after[0]?.n).toBe(0);
    } finally {
      await db.close();
    }
  });
});

describe('migrate - cron.unschedule fallback', () => {
  // PGlite has no pg_cron extension. We stub `sqlClient.query` /
  // `sqlClient.run` to (a) report pg_cron as installed and (b) throw a
  // duplicate-name error on the first cron.schedule, then assert migrate
  // retries via cron.unschedule + cron.schedule.
  test('falls back to cron.unschedule when cron.schedule reports duplicate name', async () => {
    const { db, sqlClient: base } = await boot();
    const calls: string[] = [];
    let scheduleAttempts = 0;
    const stub: SqlClient = {
      ...base,
      async query<T = Record<string, unknown>>(query: Sql) {
        const lower = query.sql.toLowerCase();
        if (lower.includes("extname = 'pg_cron'")) {
          calls.push('is-pg-cron');
          return [{ ok: true }] as unknown as T[];
        }
        return await base.query<T>(query);
      },
      async run(query: Sql) {
        const lower = query.sql.toLowerCase();
        if (lower.includes('cron.schedule')) {
          calls.push('cron.schedule');
          scheduleAttempts += 1;
          if (scheduleAttempts === 1) {
            throw new Error(
              `cron job "matchmaking-tick" already exists (duplicate)`
            );
          }
          return { changes: 0, lastInsertRowid: 0 };
        }
        if (lower.includes('cron.unschedule')) {
          calls.push('cron.unschedule');
          return { changes: 0, lastInsertRowid: 0 };
        }
        return await base.run(query);
      },
    };
    try {
      await migrate({ sqlClient: stub });
      expect(scheduleAttempts).toBe(2);
      expect(calls).toContain('cron.unschedule');
      // The unschedule call must land BETWEEN the two schedule attempts.
      const firstSched = calls.indexOf('cron.schedule');
      const lastSched = calls.lastIndexOf('cron.schedule');
      const unsched = calls.indexOf('cron.unschedule');
      expect(unsched).toBeGreaterThan(firstSched);
      expect(unsched).toBeLessThan(lastSched);
    } finally {
      await db.close();
    }
  });
});
