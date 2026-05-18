import { PGlite } from '@electric-sql/pglite';
import { Assert } from '@gamezilla/lib/assert';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { migrate } from './migrate';
import { NUM_WAITING_PARTITIONS } from './migrate-sql';
import { createPgliteSqlClient } from './pglite-adapter';
import type { SqlClient } from './sql-client';

let disposeTestCrashHandler: () => void;
beforeAll(() => {
  disposeTestCrashHandler = Assert.registerCrashHandler({
    priority: 0,
    match: () => true,
    crash(message, context) {
      throw new Error(
        context === undefined
          ? message
          : `${message} ${JSON.stringify(context)}`
      );
    },
  });
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
  }>(
    `SELECT data_type, is_generated
     FROM information_schema.columns
     WHERE table_name = $1 AND column_name = $2`,
    [table, column]
  );
  return result.rows[0] ?? null;
}

describe('migrate v3 - schema bootstrap', () => {
  test('creates 16 hash child partitions for matchmaking_waiting', async () => {
    const { db, sqlClient } = await boot();
    try {
      await migrate({ sqlClient });
      const children = await sqlClient.query<{ relname: string }>(
        `SELECT c.relname
         FROM pg_inherits i
         JOIN pg_class p ON p.oid = i.inhparent
         JOIN pg_class c ON c.oid = i.inhrelid
         WHERE p.relname = 'matchmaking_waiting'
         ORDER BY c.relname`
      );
      expect(children.rows.length).toBe(NUM_WAITING_PARTITIONS);
      for (let i = 0; i < NUM_WAITING_PARTITIONS; i += 1) {
        const suffix = i.toString().padStart(2, '0');
        expect(children.rows[i]?.relname).toBe(
          `matchmaking_waiting_p${suffix}`
        );
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
      }>(
        `SELECT c.relpersistence, c.relkind, p.partstrat
         FROM pg_class c
         LEFT JOIN pg_partitioned_table p ON p.partrelid = c.oid
         WHERE c.relname = 'matchmaking_waiting'`
      );
      expect(meta.rows[0]?.relpersistence).toBe('u');
      expect(meta.rows[0]?.relkind).toBe('p');
      expect(meta.rows[0]?.partstrat).toBe('h');
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
        `SELECT relpersistence, relkind FROM pg_class WHERE relname = 'matchmaking_matched'`
      );
      expect(meta.rows[0]?.relpersistence).toBe('p');
      expect(meta.rows[0]?.relkind).toBe('r');

      const idx = await sqlClient.query<{ indexname: string }>(
        `SELECT indexname FROM pg_indexes WHERE tablename = 'matchmaking_matched' ORDER BY indexname`
      );
      const names = new Set(idx.rows.map((r) => r.indexname));
      expect(names.has('matchmaking_matched_match_id_idx')).toBe(true);
      expect(names.has('matchmaking_matched_matched_at_idx')).toBe(true);
    } finally {
      await db.close();
    }
  });

  test('creates matchmaking_active_partitions side table (UNLOGGED, PK = partition_signature)', async () => {
    const { db, sqlClient } = await boot();
    try {
      await migrate({ sqlClient });
      const meta = await sqlClient.query<{ relpersistence: string }>(
        `SELECT relpersistence FROM pg_class WHERE relname = 'matchmaking_active_partitions'`
      );
      expect(meta.rows[0]?.relpersistence).toBe('u');
      const pk = await sqlClient.query<{ column_name: string }>(
        `SELECT a.attname AS column_name
         FROM pg_index i
         JOIN pg_attribute a
           ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
         WHERE i.indrelid = 'matchmaking_active_partitions'::regclass
           AND i.indisprimary`
      );
      expect(pk.rows.map((r) => r.column_name)).toEqual([
        'partition_signature',
      ]);
    } finally {
      await db.close();
    }
  });

  test('drops legacy v2 matchmaking_queue + matchmaking_pass_runs tables', async () => {
    const { db, sqlClient } = await boot();
    try {
      // Simulate a v2 install: create the legacy tables before migrate.
      await sqlClient.query(`CREATE TABLE matchmaking_queue (id INT)`);
      await sqlClient.query(`CREATE TABLE matchmaking_pass_runs (id INT)`);
      await migrate({ sqlClient });
      const remaining = await sqlClient.query<{ relname: string }>(
        `SELECT relname FROM pg_class
         WHERE relname IN ('matchmaking_queue', 'matchmaking_pass_runs')`
      );
      expect(remaining.rows.length).toBe(0);
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
        `SELECT schema_fingerprint FROM matchmaking_schema_state WHERE id = 1`
      );
      expect(fp.rows.length).toBe(1);
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
      await sqlClient.query(
        `INSERT INTO matchmaking_waiting (data, formulas, partition_signature)
         VALUES ($1::jsonb, $2::jsonb, $3)`,
        [
          JSON.stringify({ 'mmtest/region': 'us-east' }),
          JSON.stringify([{ numeric: [] }]),
          '',
        ]
      );

      await migrate({
        sqlClient,
        schema: { partitionKeys: ['mmtest/region'] },
      });
      const fp = await sqlClient.query<{ schema_fingerprint: string }>(
        `SELECT schema_fingerprint FROM matchmaking_schema_state WHERE id = 1`
      );
      expect(fp.rows[0]?.schema_fingerprint ?? '').toContain('mmtest/region');

      // Insert a row through the new schema using a JS-computed
      // partition_signature; verify it round-trips.
      await sqlClient.query(
        `INSERT INTO matchmaking_waiting (data, formulas, partition_signature)
         VALUES ($1::jsonb, $2::jsonb, $3)`,
        [
          JSON.stringify({ 'mmtest/region': 'eu-west' }),
          JSON.stringify([{ numeric: [] }]),
          'eu-west',
        ]
      );
      const row = await sqlClient.query<{ partition_signature: string }>(
        `SELECT partition_signature FROM matchmaking_waiting
         WHERE (data->>'mmtest/region') = 'eu-west'`
      );
      expect(row.rows[0]?.partition_signature).toBe('eu-west');
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
      }>(
        `SELECT p.proname,
                p.pronargs,
                t.typname AS prorettype_name
         FROM pg_proc p
         JOIN pg_type t ON t.oid = p.prorettype
         WHERE p.proname = 'matchmaking_tick'`
      );
      expect(fn.rows.length).toBe(1);
      expect(fn.rows[0]?.pronargs).toBe(0);
      expect(fn.rows[0]?.prorettype_name).toBe('void');
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
      await sqlClient.query(`SELECT matchmaking_tick()`);
      // Second call confirms the advisory lock was released on the
      // happy path — otherwise the second tick would silently no-op
      // (but here we just assert it doesn't throw).
      await sqlClient.query(`SELECT matchmaking_tick()`);
      // Cross-check the advisory lock is not held by the current
      // session after both ticks return.
      const held = await sqlClient.query<{ held: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM pg_locks
           WHERE locktype = 'advisory'
             AND pid = pg_backend_pid()
         ) AS held`
      );
      expect(held.rows[0]?.held).toBe(false);
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
        `SELECT COUNT(*)::INT AS n FROM pg_proc WHERE proname = 'matchmaking_tick'`
      );
      expect(count.rows[0]?.n).toBe(1);
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
      const hasCronJob = await sqlClient.query<{ ok: boolean }>(
        `SELECT EXISTS (
           SELECT 1
           FROM information_schema.schemata
           WHERE schema_name = 'cron'
         ) AS ok`
      );
      expect(hasCronJob.rows[0]?.ok).toBe(false);
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
