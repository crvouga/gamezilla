/**
 * Pin for BUG-1: JS engine `Cannot convert BigInt to number` on Postgres int8.
 * Every default backend must return safe integers as number (never bigint).
 */
import { describe, expect, test } from 'bun:test';
import { defineTable, registerTables } from '@pkgs/db-schema';
import { applyPostgresSchema } from '@pkgs/db-schema-postgres';
import { applySqliteSchema } from '@pkgs/db-schema-sqlite';
import { raw } from '@pkgs/sql';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres-db-scope';
import { ALWAYS_FACTORIES, openBackend } from './helpers/backends';
import { dropTables } from './helpers/backends/drop-tables';
import { assertWireSafeRows, assertWireSafeRunResult } from './helpers/oracles';

describe('bug-bigint-int8.pbt', () => {
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
          await applyPostgresSchema(
            backend.client,
            schema,
            createPostgresDbScope('public'),
            { skipAdvisoryLock: true }
          );
        } else {
          await applySqliteSchema(backend.client, schema);
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
