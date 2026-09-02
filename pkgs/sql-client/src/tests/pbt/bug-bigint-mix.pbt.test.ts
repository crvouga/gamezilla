/**
 * Pin for BUG-2: in-engine int8 `n + 1` must not throw
 * `Cannot mix BigInt and other types` (postgres-mem toI8 / addI).
 *
 * Product shape: allocateTopicPushSeq two-shot ON CONFLICT upsert on a
 * defineTable `integer` column (physical bigint on Postgres).
 */
import './_shared-teardown';
import { describe, expect, test } from 'bun:test';
import { defineTable, registerTables } from '@pkgs/db-schema';
import { applyPostgresSchema } from '@pkgs/db-schema/postgres';
import { applySqliteSchema } from '@pkgs/db-schema/sqlite';
import { ident, sql } from '@pkgs/sql';
import { createPostgresDbScope } from '../../postgres/schema';
import { ALWAYS_FACTORIES, openBackend } from '../backends';
import { dropTables } from '../backends/drop-tables';
import { assertWireSafeRows } from '../oracles';

describe('bug-bigint-mix.pbt', () => {
  test('ON CONFLICT n + 1 twice does not mix BigInt / number', async () => {
    for (const factory of ALWAYS_FACTORIES) {
      const backend = await openBackend(factory);
      const table = `int8_mix_${backend.kind.replace(/-/g, '_')}`;
      try {
        const schema = registerTables([
          defineTable({
            domain: 'int8_mix',
            name: table,
            columns: { topic: 'text', n: 'integer' },
            uniqueIndexes: ['topic'],
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

        const ts = '2020-01-01T00:00:00.000Z';
        const tableIdent = ident(table);
        const upsert = sql<{ n: number | string }>`
          INSERT INTO ${tableIdent} (
            id, topic, n, created_at, updated_at, deleted_at
          )
          VALUES (
            ${'system:client_config'},
            ${'system:client_config'},
            ${1},
            ${ts},
            ${ts},
            ${null}
          )
          ON CONFLICT (id) DO UPDATE
            SET n = ${tableIdent}.n + 1,
                updated_at = ${ts},
                deleted_at = NULL
          RETURNING n
        `;

        const first = await backend.client.query(upsert);
        assertWireSafeRows(first, `${backend.name}:upsert1`);
        expect(Number(first[0]?.n)).toBe(1);
        expect(typeof first[0]?.n).not.toBe('bigint');
        expect(() => JSON.stringify(first)).not.toThrow();

        const second = await backend.client.query(upsert);
        assertWireSafeRows(second, `${backend.name}:upsert2`);
        expect(Number(second[0]?.n)).toBe(2);
        expect(typeof second[0]?.n).not.toBe('bigint');
        expect(() => JSON.stringify(second)).not.toThrow();

        const limited = await backend.client.query(
          sql<{ n: number | string }>`
            SELECT n FROM ${tableIdent} LIMIT ${100}
          `
        );
        assertWireSafeRows(limited, `${backend.name}:limit`);
        expect(Number(limited[0]?.n)).toBe(2);
      } finally {
        await dropTables(backend.client, [table], backend.dialect);
        await backend.close();
      }
    }
  }, 120_000);
});
