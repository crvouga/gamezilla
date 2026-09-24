import { describe, expect, test } from 'bun:test';
import { defineTable, registerTables } from '@pkgs/db-schema';
import { createRecordingPostgresClient } from '@pkgs/db-schema/test/fake-sql-client';
import { join, sql } from '@pkgs/sql';
import { postgres } from '../src/driver';
import { createMockingbirdPostgresTestClient } from '../src/test/mockingbird-postgres-test-client';

const ROWS = 2500;
const CHUNK = 500;

describe('postgres batched backfill', () => {
  test('backfills every matching row in more than one UPDATE', async () => {
    const harness = await createMockingbirdPostgresTestClient('backfill_batch');
    try {
      const v1 = registerTables([
        defineTable({
          domain: 'entries',
          name: 'entries',
          columns: { label: 'text' },
        }),
      ]);
      await postgres(v1, harness.sqlClient, {
        skipAdvisoryLock: true,
      }).reconcile();

      for (let start = 0; start < ROWS; start += CHUNK) {
        const tuples = [];
        for (let i = start; i < Math.min(start + CHUNK, ROWS); i++) {
          const id = `r${String(i).padStart(4, '0')}`;
          tuples.push(sql`(${id}, ${`label-${i}`})`);
        }
        await harness.sqlClient.run(
          sql`INSERT INTO entries (id, label) VALUES ${join(tuples, ', ')}`
        );
      }

      const recording = createRecordingPostgresClient(
        harness.sqlClient.dbScope,
        harness.sqlClient
      );
      const v2 = registerTables([
        defineTable({
          domain: 'entries',
          name: 'entries',
          columns: {
            label: 'text',
            label_copy: { type: 'text', backfill: { from: 'label' } },
          },
        }),
      ]);
      await postgres(v2, recording, {
        skipAdvisoryLock: true,
        alreadyInTransaction: true,
      }).reconcile();

      const updates = recording.calls.filter(
        (c) => c.kind === 'run' && /^UPDATE\b/i.test(c.sql)
      );
      expect(updates.length).toBeGreaterThan(1);

      const rows = await harness.sqlClient.query<{
        id: string;
        label: string;
        label_copy: string | null;
      }>(sql`SELECT id, label, label_copy FROM entries ORDER BY id`);
      expect(rows.length).toBe(ROWS);
      expect(rows.filter((r) => r.label_copy !== r.label)).toEqual([]);
    } finally {
      await harness.close();
    }
    // 2500 rows through mockingbird-postgres: ~3s alone, past 10s under turbo load.
  }, 60_000);

  test('NULL-yielding backfill terminates and leaves the target NULL', async () => {
    const harness = await createMockingbirdPostgresTestClient('backfill_null');
    try {
      const v1 = registerTables([
        defineTable({
          domain: 'entries',
          name: 'entries',
          columns: { other_nullable: 'text' },
        }),
      ]);
      await postgres(v1, harness.sqlClient, {
        skipAdvisoryLock: true,
      }).reconcile();
      await harness.sqlClient.run(
        sql`INSERT INTO entries (id, other_nullable) VALUES (${'a'}, ${null}), (${'b'}, ${null})`
      );

      const recording = createRecordingPostgresClient(
        harness.sqlClient.dbScope,
        harness.sqlClient
      );
      const v2 = registerTables([
        defineTable({
          domain: 'entries',
          name: 'entries',
          columns: {
            other_nullable: 'text',
            copied: { type: 'text', backfill: { from: 'other_nullable' } },
          },
        }),
      ]);
      await postgres(v2, recording, {
        skipAdvisoryLock: true,
        alreadyInTransaction: true,
      }).reconcile();

      const rows = await harness.sqlClient.query<{ copied: string | null }>(
        sql`SELECT copied FROM entries ORDER BY id`
      );
      expect(rows).toEqual([{ copied: null }, { copied: null }]);
      // The cursor advanced past the NULL rows instead of re-selecting them.
      expect(
        recording.calls.filter(
          (c) => c.kind === 'run' && /^UPDATE\b/i.test(c.sql)
        ).length
      ).toBe(1);
    } finally {
      await harness.close();
    }
  });
});
