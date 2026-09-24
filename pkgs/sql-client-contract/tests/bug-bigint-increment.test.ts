/**
 * An int8 counter upsert increments on every default backend. postgres-mem's
 * `toI8` can leave a JS number in an int8 slot, so `n = t.n + 1` did
 * `number + bigint` inside the engine and threw `Cannot mix BigInt and other
 * types` — every second push on a topic failed in the product simulator.
 * Both the bare literal and the portable `CAST(1 AS BIGINT)` that
 * `@pkgs/sync-engine`'s `allocateTopicPushSeq` uses must keep working.
 */
import { describe, expect, test } from 'bun:test';
import { defineTable, registerTables } from '@pkgs/db-schema';
import { applyPostgresSchema } from '@pkgs/db-schema-postgres';
import { applySqliteSchema } from '@pkgs/db-schema-sqlite';
import { raw } from '@pkgs/sql';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres-db-scope';
import { ALWAYS_FACTORIES, openBackend } from './helpers/backends';
import { dropTables } from './helpers/backends/drop-tables';
import { assertWireSafeRows } from './helpers/oracles';

describe('int8 counter upsert', () => {
  // regression: sql-int8-increment-bigint-mix
  test('`n + 1` and `n + CAST(1 AS BIGINT)` increment without mixing BigInt', async () => {
    for (const [factory, step] of ALWAYS_FACTORIES.flatMap((f) =>
      ['1', 'CAST(1 AS BIGINT)'].map((s) => [f, s] as const)
    )) {
      const backend = await openBackend(factory);
      const table = `int8_seq_${backend.kind.replace(/-/g, '_')}`;
      try {
        const schema = registerTables([
          defineTable({
            domain: 'int8_seq',
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
        const upsert = raw<{ n: number }>(
          `INSERT INTO ${table} (id, n) VALUES ('t', 1)
           ON CONFLICT (id) DO UPDATE SET n = ${table}.n + ${step}
           RETURNING n`
        );
        const seen: number[] = [];
        for (let i = 0; i < 3; i++) {
          const rows = await backend.client.query(upsert);
          assertWireSafeRows(rows, `${backend.name}:upsert-${String(i)}`);
          seen.push(Number(rows[0]?.n));
        }
        expect(seen, `${backend.name} n + ${step}`).toEqual([1, 2, 3]);
      } finally {
        await dropTables(backend.client, [table], backend.dialect);
        await backend.close();
      }
    }
  }, 120_000);
});
