/**
 * Every default backend returns safe integers as number, never bigint: the
 * product harness's hydrate once died with `Cannot convert BigInt to number`
 * when mockingbird-postgres returned `bigint` for domain `integer` (physical `bigint`)
 * columns. Fixed by `normalizePgInt8Value` (decimal text, engine-safe).
 */
import { describe, expect, test } from 'bun:test';
import { defineTable } from '@pkgs/db-schema-shared/define-table';
import { registerTables } from '@pkgs/db-schema-shared/register-tables';
import { reconcilePostgresSchema } from '@pkgs/db-schema-postgres-shared/reconcile-postgres-schema';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import { raw } from '@pkgs/sql-shared/sql';
import { createPostgresDbScope } from '@pkgs/sql-client-shared/postgres-db-scope';
import { ALWAYS_FACTORIES, openBackend } from './registry';
import { dropTables } from './drop-tables';
import { assertWireSafeRows, assertWireSafeRunResult } from './wire-safety';

describe('int8 rows are wire-safe numbers', () => {
  // regression: sql-int8-rows-bigint
  test('int8 / INTEGER / COUNT(*) never surface as bigint', async () => {
    for (const factory of ALWAYS_FACTORIES) {
      const backend = await openBackend(factory);
      const table = `int8_pin_${backend.kind.replace(/-/g, '_')}`;
      try {
        const schema = registerTables([
          defineTable({
            domain: 'int8_pin',
            name: table,
            columns: { n: 'integer' },
          }),
        ]);
        if (backend.dialect === 'postgres') {
          await reconcilePostgresSchema(
            backend.client,
            schema,
            createPostgresDbScope('public'),
            { skipAdvisoryLock: true }
          );
        } else {
          await reconcileSqliteSchema(backend.client, schema);
        }
        const runInsert = await backend.client.run(
          raw(`INSERT INTO ${table} (id, n) VALUES ('a', 42)`)
        );
        assertWireSafeRunResult(runInsert, `${backend.name}:insert`);

        const rows = await backend.client.query<{ n: number }>(
          raw(`SELECT n FROM ${table}`)
        );
        assertWireSafeRows(rows, `${backend.name}:select`);
        expect(rows[0]?.n).toBe(42);
        expect(typeof rows[0]?.n).toBe('number');
        expect(() => JSON.stringify(rows)).not.toThrow();
        expect(Math.max(0, rows[0]!.n)).toBe(42);

        const counts = await backend.client.query<{ n: number | string }>(
          raw(`SELECT COUNT(*) AS n FROM ${table}`)
        );
        assertWireSafeRows(counts, `${backend.name}:count`);
        expect(Number(counts[0]?.n)).toBe(1);
        expect(typeof counts[0]?.n).not.toBe('bigint');

        if (backend.dialect === 'postgres') {
          const cast = await backend.client.query<{ n: number }>(
            raw(`SELECT 42::int8 AS n`)
          );
          assertWireSafeRows(cast, `${backend.name}:int8-cast`);
          expect(cast[0]?.n).toBe(42);
          expect(typeof cast[0]?.n).toBe('number');
        }
      } finally {
        await dropTables(backend.client, [table], backend.dialect);
        await backend.close();
      }
    }
  }, 120_000);
});
