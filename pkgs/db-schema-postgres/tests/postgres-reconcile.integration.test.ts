import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { defineTable, registerTables } from '@pkgs/db-schema';
import { defineSchema } from '@pkgs/db-schema/core/define-schema';
import { createRecordingSqlClient } from '@pkgs/db-schema/test/fake-sql-client';
import { applyPostgresSchema } from '@pkgs/db-schema-postgres';
import { raw, sql } from '@pkgs/sql';
import type { PostgresSqlClient } from '@pkgs/sql-client/interface';
import { readPostgresCatalog } from '../src/catalog';
import { postgres } from '../src/driver';
import { createPglitePostgresClient } from '../src/test/pglite-postgres-client';

describe('postgres reconcile integration', () => {
  let sqlClient: PostgresSqlClient;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const harness = await createPglitePostgresClient('app_schema');
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
    await sqlClient.run(
      raw(`ALTER TABLE clash ALTER COLUMN weird SET NOT NULL`)
    );
    const before = await sqlClient.query<{ column_name: string }>(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = ${sqlClient.dbScope.schema}
        AND table_name = 'clash'
      ORDER BY column_name
    `);

    const schema = defineSchema({
      tables: { clash: { body: 'text' } },
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

  test('legacy NOT NULL and int4 columns reconcile after nullability fix', async () => {
    await applyPostgresSchema(
      sqlClient,
      registerTables([
        defineTable({
          domain: 'legacy_puzzle_shape',
          name: 'legacy_puzzle_shape',
          columns: { rating: 'integer', body: 'text' },
        }),
      ]),
      sqlClient.dbScope
    );
    await sqlClient.run(
      raw(`ALTER TABLE legacy_puzzle_shape ALTER COLUMN rating SET NOT NULL`)
    );
    await sqlClient.run(
      raw(`ALTER TABLE legacy_puzzle_shape ALTER COLUMN body SET NOT NULL`)
    );
    await sqlClient.run(
      raw(`ALTER TABLE legacy_puzzle_shape ALTER COLUMN rating DROP NOT NULL`)
    );
    await sqlClient.run(
      raw(`ALTER TABLE legacy_puzzle_shape ALTER COLUMN body DROP NOT NULL`)
    );

    const schema = defineSchema({
      tables: {
        legacy_puzzle_shape: { rating: 'integer', body: 'text' },
      },
    });
    await postgres(schema, sqlClient).reconcile();

    const catalog = await readPostgresCatalog(sqlClient, schema._declared);
    const rating = catalog.tables
      .get('legacy_puzzle_shape')
      ?.columns.find((c) => c.name === 'rating');
    const body = catalog.tables
      .get('legacy_puzzle_shape')
      ?.columns.find((c) => c.name === 'body');
    expect(rating?.type).toBe('integer');
    expect(rating?.nullable).toBe(true);
    expect(body?.nullable).toBe(true);
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
