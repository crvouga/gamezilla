import { PGlite } from '@electric-sql/pglite';
import { Assert } from '@gamezilla/lib/assert';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { migrate } from './migrate';
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
  column: string
): Promise<{ data_type: string; is_generated: string } | null> {
  const result = await sqlClient.query<{
    data_type: string;
    is_generated: string;
  }>(
    `SELECT data_type, is_generated
     FROM information_schema.columns
     WHERE table_name = 'matchmaking_queue' AND column_name = $1`,
    [column]
  );
  return result.rows[0] ?? null;
}

describe('migrate - schema bootstrap', () => {
  test('creates the pass-runs throttle table with (partition_signature, kind) PK', async () => {
    const { db, sqlClient } = await boot();
    try {
      await migrate({ sqlClient });
      // Empty table on a fresh migrate — rows are lazy-created on first
      // reference per (partition, kind). The PK shape is the contract.
      const cols = await sqlClient.query<{ column_name: string }>(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_name = 'matchmaking_pass_runs'
         ORDER BY ordinal_position`
      );
      expect(cols.rows.map((r) => r.column_name)).toEqual([
        'partition_signature',
        'kind',
        'last_at',
      ]);
      const pk = await sqlClient.query<{ column_name: string }>(
        `SELECT a.attname AS column_name
         FROM pg_index i
         JOIN pg_attribute a
           ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
         WHERE i.indrelid = 'matchmaking_pass_runs'::regclass
           AND i.indisprimary
         ORDER BY array_position(i.indkey, a.attnum)`
      );
      expect(pk.rows.map((r) => r.column_name)).toEqual([
        'partition_signature',
        'kind',
      ]);
    } finally {
      await db.close();
    }
  });

  test('default schema generates partition_signature, primary_rating, primary_bucket as stored columns', async () => {
    const { db, sqlClient } = await boot();
    try {
      await migrate({ sqlClient });
      const partSig = await columnDef(sqlClient, 'partition_signature');
      const rating = await columnDef(sqlClient, 'primary_rating');
      const bucket = await columnDef(sqlClient, 'primary_bucket');
      expect(partSig?.is_generated).toBe('ALWAYS');
      expect(rating?.is_generated).toBe('ALWAYS');
      expect(bucket?.is_generated).toBe('ALWAYS');
    } finally {
      await db.close();
    }
  });

  test('creates the waiting partial index and the matched partial index', async () => {
    const { db, sqlClient } = await boot();
    try {
      await migrate({ sqlClient });
      const idx = await sqlClient.query<{
        indexname: string;
        indexdef: string;
      }>(
        `SELECT indexname, indexdef
         FROM pg_indexes
         WHERE tablename = 'matchmaking_queue'`
      );
      const byName = new Map(idx.rows.map((r) => [r.indexname, r.indexdef]));
      const waiting = byName.get(
        'matchmaking_queue_waiting_partition_bucket_idx'
      );
      const matched = byName.get('matchmaking_queue_matched_joined_at_idx');
      const legacy = byName.get('matchmaking_queue_status_bucket_idx');
      expect(waiting).toBeDefined();
      expect(matched).toBeDefined();
      expect(legacy).toBeUndefined();
      expect(waiting).toMatch(/WHERE.+status\s*=\s*'waiting'/i);
      expect(matched).toMatch(/WHERE.+status\s*=\s*'matched'/i);
    } finally {
      await db.close();
    }
  });
});

describe('migrate - idempotency', () => {
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

  test('running migrate with a different schema rebuilds the generated columns', async () => {
    const { db, sqlClient } = await boot();
    try {
      await migrate({ sqlClient });

      // Insert a row so the rebuild actually has rows to recompute.
      const inserted = await sqlClient.query<{ id: string }>(
        `INSERT INTO matchmaking_queue (data, formulas)
         VALUES ($1::jsonb, $2::jsonb) RETURNING id`,
        [
          JSON.stringify({ 'mmtest/region': 'us-east' }),
          JSON.stringify([{ numeric: [] }]),
        ]
      );
      const id = inserted.rows[0]?.id;
      expect(id).toBeDefined();

      // Re-migrate with partitionKeys declared — partition_signature
      // expression now references mmtest/region.
      await migrate({
        sqlClient,
        schema: { partitionKeys: ['mmtest/region'] },
      });
      const row = await sqlClient.query<{ partition_signature: string }>(
        `SELECT partition_signature FROM matchmaking_queue WHERE id = $1`,
        [id]
      );
      expect(row.rows[0]?.partition_signature).toBe('us-east');

      // Re-migrate with a different primaryNumericKey → another rebuild.
      await migrate({
        sqlClient,
        schema: {
          partitionKeys: ['mmtest/region'],
          primaryNumericKey: 'mmtest/rating',
          bucketWidth: 100,
        },
      });
      const row2 = await sqlClient.query<{
        primary_rating: string | null;
        primary_bucket: number | null;
      }>(
        `SELECT primary_rating, primary_bucket FROM matchmaking_queue WHERE id = $1`,
        [id]
      );
      // No rating attr on this row → coerces to 0 / bucket 0.
      expect(row2.rows[0]?.primary_bucket).toBe(0);
    } finally {
      await db.close();
    }
  });
});

describe('migrate - schema validation', () => {
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
