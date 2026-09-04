import { describe, expect, test } from 'bun:test';
import { raw } from '@pkgs/sql';
import { planClient } from '../src/core/plan';
import { defineTable, registerTables } from '../src/index';
import { readPostgresCatalog } from '../src/postgres/catalog';
import { postgres } from '../src/postgres/driver';
import { readSqliteCatalog } from '../src/sqlite/catalog';
import { sqlite } from '../src/sqlite/driver';
import { createPglitePostgresClient } from '../src/test/pglite-postgres-client';

describe('db-schema roundtrip PBT pins', () => {
  test('sqlite: apply then re-plan is empty', async () => {
    const { SqlClientImplSqliteMem } = await import(
      '@pkgs/sql-client/sqlite/impl-sqlite-mem'
    );
    const client = SqlClientImplSqliteMem.open();
    await client.connect();
    try {
      const schema = registerTables([
        defineTable({
          domain: 'notes',
          name: 'notes',
          columns: { body: 'text', slug: 'text' },
          indexes: ['slug'],
        }),
      ]);
      await sqlite(schema, client).reconcile();
      const catalog = await readSqliteCatalog(client, schema._declared);
      const plan = planClient(schema._declared, catalog);
      expect(plan.ok).toBe(true);
      if (!plan.ok) return;
      expect(plan.operations.length).toBe(0);
    } finally {
      await client.disconnect();
    }
  });

  test('postgres: apply then re-plan is empty', async () => {
    const harness = await createPglitePostgresClient('roundtrip');
    try {
      const schema = registerTables([
        defineTable({
          domain: 'notes',
          name: 'notes',
          columns: { body: 'text', slug: 'text' },
          indexes: ['slug'],
        }),
      ]);
      await postgres(schema, harness.sqlClient, {
        skipAdvisoryLock: true,
      }).reconcile();
      const catalog = await readPostgresCatalog(
        harness.sqlClient,
        schema._declared
      );
      const plan = await import('../src/core/plan').then((m) =>
        m.planServer(schema._declared, catalog)
      );
      expect(plan.ok).toBe(true);
      if (!plan.ok) return;
      expect(plan.operations.length).toBe(0);
    } finally {
      await harness.close();
    }
  });
});

describe('db-schema data-loss pins', () => {
  test('sqlite rebuild preserves row ids and live columns', async () => {
    const { SqlClientImplSqliteMem } = await import(
      '@pkgs/sql-client/sqlite/impl-sqlite-mem'
    );
    const client = SqlClientImplSqliteMem.open();
    await client.connect();
    try {
      const v1 = registerTables([
        defineTable({
          domain: 'notes',
          name: 'notes',
          columns: { body: 'text', extra: 'text' },
          indexes: ['body'],
        }),
      ]);
      await sqlite(v1, client).reconcile();
      await client.run(
        raw(`INSERT INTO notes (id, body, extra) VALUES ('a', 'hello', 'x')`)
      );
      const v2 = registerTables([
        defineTable({
          domain: 'notes',
          name: 'notes',
          columns: { body: 'text' },
          indexes: ['body'],
          deprecations: [['extra', 'unused']],
        }),
      ]);
      await sqlite(v2, client).reconcile();
      const rows = await client.query<{ id: string; body: string }>(
        raw(`SELECT id, body FROM notes ORDER BY id`)
      );
      expect(rows).toEqual([{ id: 'a', body: 'hello' }]);
      const catalog = await readSqliteCatalog(client, v2._declared);
      expect(catalog.indexes.some((ix) => ix.name.startsWith('ix_'))).toBe(
        true
      );
    } finally {
      await client.disconnect();
    }
  });

  test('renamedFrom copies values without data loss', async () => {
    const { SqlClientImplSqliteMem } = await import(
      '@pkgs/sql-client/sqlite/impl-sqlite-mem'
    );
    const client = SqlClientImplSqliteMem.open();
    await client.connect();
    try {
      const v1 = registerTables([
        defineTable({
          domain: 'notes',
          name: 'notes',
          columns: { name: 'text' },
        }),
      ]);
      await sqlite(v1, client).reconcile();
      await client.run(
        raw(`INSERT INTO notes (id, name) VALUES ('1', 'alice')`)
      );
      const v2 = registerTables([
        defineTable({
          domain: 'notes',
          name: 'notes',
          columns: {
            display_name: { type: 'text', renamedFrom: 'name' },
          },
          deprecations: [['name', 'renamed']],
        }),
      ]);
      await sqlite(v2, client).reconcile();
      const rows = await client.query<{ display_name: string }>(
        raw(`SELECT display_name FROM notes WHERE id = '1'`)
      );
      expect(rows[0]?.display_name).toBe('alice');
    } finally {
      await client.disconnect();
    }
  });
});
