import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { defineTable, registerTables } from '@pkgs/db-schema';
import { defineSchema } from '@pkgs/db-schema/core/define-schema';
import { createRecordingSqlClient } from '@pkgs/db-schema/test/fake-sql-client';
import { applyPostgresSchema } from '@pkgs/db-schema-postgres';
import { sql } from '@pkgs/sql';
import type { PostgresSqlClient } from '@pkgs/sql-client/interface';
import { readPostgresCatalog } from '../src/catalog';
import { postgres } from '../src/driver';
import { createMockingbirdPostgresTestClient } from '../src/test/mockingbird-postgres-test-client';

describe('postgres reconcile integration', () => {
  let sqlClient: PostgresSqlClient;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const harness = await createMockingbirdPostgresTestClient('app_schema');
    sqlClient = harness.sqlClient;
    close = harness.close;
  });

  afterAll(async () => {
    await close?.();
  });

  test('empty then reconcile twice is noop on second run', async () => {
    const schema = defineSchema({
      tables: {
        notes: { body: 'text', title: 'text' },
      },
      indexes: [['notes', 'title']],
    });

    await postgres(schema, sqlClient).reconcile();

    const recording = createRecordingSqlClient(sqlClient);
    const proxy: PostgresSqlClient = {
      dbScope: sqlClient.dbScope,
      connect: () => sqlClient.connect(),
      disconnect: () => sqlClient.disconnect(),
      query: async (q) => {
        recording.calls.push({ kind: 'query', sql: q.sql, values: q.values });
        return sqlClient.query(q);
      },
      run: async (q) => {
        recording.calls.push({ kind: 'run', sql: q.sql, values: q.values });
        return sqlClient.run(q);
      },
      transaction: (fn) =>
        sqlClient.transaction(async (tx) => {
          const wrapped = {
            ...tx,
            run: async (q: Parameters<typeof tx.run>[0]) => {
              recording.calls.push({
                kind: 'run',
                sql: q.sql,
                values: q.values,
              });
              return tx.run(q);
            },
            query: async (q: Parameters<typeof tx.query>[0]) => {
              recording.calls.push({
                kind: 'query',
                sql: q.sql,
                values: q.values,
              });
              return tx.query(q);
            },
          };
          return fn(wrapped as typeof tx);
        }),
      prepare: (q) => sqlClient.prepare(q),
    };

    await postgres(schema, proxy).reconcile();
    const ddlRuns = recording.calls.filter(
      (c) =>
        c.kind === 'run' &&
        !/pg_advisory_/i.test(c.sql) &&
        !/CREATE SCHEMA/i.test(c.sql)
    );
    expect(
      ddlRuns.filter((c) =>
        /CREATE TABLE|ALTER TABLE|CREATE INDEX|DROP INDEX/i.test(c.sql)
      ).length
    ).toBe(0);
  });

  test('accrete a column', async () => {
    const v1 = defineSchema({
      tables: { items: { label: 'text' } },
    });
    await postgres(v1, sqlClient).reconcile();

    const v2 = defineSchema({
      tables: { items: { label: 'text', detail: 'text' } },
    });
    await postgres(v2, sqlClient).reconcile();

    const catalog = await readPostgresCatalog(sqlClient, v2._declared);
    expect(
      catalog.tables.get('items')?.columns.some((c) => c.name === 'detail')
    ).toBe(true);
  });

  test('undeclared table blindness', async () => {
    await applyPostgresSchema(
      sqlClient,
      registerTables([
        defineTable({
          domain: 'ghost',
          name: 'ghost_billing',
          columns: {},
        }),
      ]),
      sqlClient.dbScope
    );
    const schema = defineSchema({
      tables: { widgets: { name: 'text' } },
    });
    await postgres(schema, sqlClient).reconcile();

    const stillThere = await sqlClient.query<{ table_name: string }>(sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = ${sqlClient.dbScope.schema}
        AND table_name = 'ghost_billing'
    `);
    expect(stillThere.length).toBe(1);
  });

  test('collision with mismatched shape is drift and leaves catalog unchanged', async () => {
    await applyPostgresSchema(
      sqlClient,
      registerTables([
        defineTable({
          domain: 'clash',
          name: 'clash',
          columns: { weird: 'integer' },
        }),
      ]),
      sqlClient.dbScope
    );
    const before = await sqlClient.query<{ column_name: string }>(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = ${sqlClient.dbScope.schema}
        AND table_name = 'clash'
      ORDER BY column_name
    `);

    // Redeclaring the pre-existing column with a different type is a shape
    // collision that must be refused with zero DDL. mockingbird-postgres cannot
    // ALTER COLUMN SET NOT NULL ("this ALTER COLUMN form is not supported"),
    // so the mismatch is a declared type change, not a nullability one.
    const schema = defineSchema({
      tables: { clash: { weird: 'text' } },
    });
    await expect(postgres(schema, sqlClient).reconcile()).rejects.toThrow(
      /drift/
    );

    const after = await sqlClient.query<{ column_name: string }>(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = ${sqlClient.dbScope.schema}
        AND table_name = 'clash'
      ORDER BY column_name
    `);
    expect(after).toEqual(before);
  });

  test('honors dbScope.schema', async () => {
    expect(sqlClient.dbScope.schema).toBe('app_schema');
    const schema = defineSchema({
      tables: { scoped_t: { x: 'text' } },
    });
    await postgres(schema, sqlClient).reconcile();
    const rows = await sqlClient.query<{ table_schema: string }>(sql`
      SELECT table_schema FROM information_schema.tables
      WHERE table_name = 'scoped_t'
    `);
    expect(rows[0]?.table_schema).toBe('app_schema');
  });

  test('concurrent reconcile serializes via advisory lock', async () => {
    const schema = defineSchema({
      tables: { concurrent_t: { v: 'text' } },
    });
    await Promise.all([
      postgres(schema, sqlClient).reconcile(),
      postgres(schema, sqlClient).reconcile(),
    ]);
    const catalog = await readPostgresCatalog(sqlClient, schema._declared);
    expect(catalog.tables.has('concurrent_t')).toBe(true);
  });
});
