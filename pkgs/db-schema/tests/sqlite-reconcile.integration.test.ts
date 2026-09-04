import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';
import { defineTable, registerTables } from '@pkgs/db-schema';
import { applySqliteSchema } from '@pkgs/db-schema/sqlite';
import { raw } from '@pkgs/sql';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';
import { defineSchema } from '../src/core/define-schema';
import { readSqliteCatalog } from '../src/sqlite/catalog';
import { sqlite } from '../src/sqlite/driver';
import { createRecordingSqlClient } from '../src/test/fake-sql-client';

function openMemoryClient() {
  const db = new Database(':memory:');
  const client = new SqlClientImplBunSqlite(db);
  return { db, client };
}

describe('sqlite reconcile integration', () => {
  test('empty then reconcile twice is noop on second run', async () => {
    const { client } = openMemoryClient();
    const schema = defineSchema({
      tables: {
        notes: { body: 'text', title: 'text' },
      },
      indexes: [['notes', 'title']],
    });

    await sqlite(schema, client).reconcile();

    const recording = createRecordingSqlClient(client);
    await sqlite(schema, recording).reconcile();
    expect(recording.runCalls.length).toBe(0);
  });

  test('accrete a column and reconcile', async () => {
    const { client } = openMemoryClient();
    const v1 = defineSchema({
      tables: { notes: { body: 'text' } },
    });
    await sqlite(v1, client).reconcile();

    const v2 = defineSchema({
      tables: { notes: { body: 'text', title: 'text' } },
    });
    await sqlite(v2, client).reconcile();

    const catalog = await readSqliteCatalog(client, v2._declared);
    const notes = catalog.tables.get('notes');
    expect(notes?.columns.some((c) => c.name === 'title')).toBe(true);
  });

  test('extra column without deprecation fails; ghost table still drops', async () => {
    const { client } = openMemoryClient();
    await applySqliteSchema(
      client,
      registerTables([
        defineTable({
          domain: 'ghost',
          name: 'ghost',
          columns: {},
        }),
      ]),
      { ownership: 'declared-only' }
    );
    await applySqliteSchema(
      client,
      registerTables([
        defineTable({
          domain: 'notes',
          name: 'notes',
          columns: { body: 'text', extra: 'text' },
        }),
      ])
    );

    const schema = defineSchema({
      tables: { notes: { body: 'text' } },
    });
    await expect(sqlite(schema, client).reconcile()).rejects.toThrow(
      /extra|deprecation/
    );
  });

  test('converge: drop unknown table; deprecate then drop extra column', async () => {
    const { client } = openMemoryClient();
    await applySqliteSchema(
      client,
      registerTables([
        defineTable({
          domain: 'ghost',
          name: 'ghost',
          columns: {},
        }),
      ]),
      { ownership: 'declared-only' }
    );
    await applySqliteSchema(
      client,
      registerTables([
        defineTable({
          domain: 'notes',
          name: 'notes',
          columns: { body: 'text', extra: 'text' },
        }),
      ])
    );

    const schema = defineSchema({
      tables: { notes: { body: 'text' } },
      deprecations: [['notes', 'extra', 'unused']],
    });
    await sqlite(schema, client, { ownership: 'whole-db' }).reconcile();

    const catalog = await readSqliteCatalog(client, schema._declared);
    expect(catalog.allTableNames.has('ghost')).toBe(false);
    expect(
      catalog.tables.get('notes')?.columns.some((c) => c.name === 'extra')
    ).toBe(false);
    expect(
      catalog.tables.get('notes')?.columns.some((c) => c.name === 'body')
    ).toBe(true);
  });

  test('preserves _meta across rebuild', async () => {
    const { client } = openMemoryClient();
    await applySqliteSchema(
      client,
      registerTables([
        defineTable({
          domain: 'notes',
          name: 'notes',
          columns: { body: 'text', extra: 'text' },
        }),
      ])
    );
    await client.run(raw(`ALTER TABLE notes ADD COLUMN _meta TEXT`));
    await client.run(
      raw(
        `INSERT INTO notes (id, body, extra, _meta) VALUES ('1', 'hi', 'x', 'keep')`
      )
    );

    const schema = defineSchema({
      tables: { notes: { body: 'text' } },
      deprecations: [['notes', 'extra', 'unused']],
    });
    await sqlite(schema, client).reconcile();

    const rows = await client.query<{ _meta: string }>(
      raw(`SELECT _meta FROM notes`)
    );
    expect(rows[0]?._meta).toBe('keep');
    const catalog = await readSqliteCatalog(client, schema._declared);
    expect(
      catalog.tables.get('notes')?.columns.some((c) => c.name === '_meta')
    ).toBe(true);
    expect(
      catalog.tables.get('notes')?.columns.some((c) => c.name === 'extra')
    ).toBe(false);
  });

  test('deprecate tombstone drops undeclared column on rebuild', async () => {
    const { client } = openMemoryClient();
    const v1 = defineSchema({
      tables: {
        notes: { body: 'text', old_field: 'text' },
      },
    });
    await sqlite(v1, client).reconcile();

    const v2 = defineSchema({
      tables: {
        notes: { body: 'text' },
      },
      deprecations: [['notes', 'old_field', 'unused']],
    });
    await sqlite(v2, client).reconcile();
    const catalog = await readSqliteCatalog(client, v2._declared);
    expect(
      catalog.tables.get('notes')?.columns.some((c) => c.name === 'old_field')
    ).toBe(false);

    const recording = createRecordingSqlClient(client);
    await sqlite(v2, recording).reconcile();
    expect(recording.runCalls.length).toBe(0);
  });

  test('uniqueIndexes emit UNIQUE INDEX', async () => {
    const { client } = openMemoryClient();
    const schema = defineSchema({
      tables: { notes: { body: 'text', slug: 'text' } },
      uniqueIndexes: [['notes', 'slug']],
    });
    await sqlite(schema, client).reconcile();
    const catalog = await readSqliteCatalog(client, schema._declared);
    expect(catalog.indexes.some((ix) => ix.name.startsWith('ux_'))).toBe(true);
  });

  test('declared-only leaves undeclared tables alone', async () => {
    const { client } = openMemoryClient();
    await applySqliteSchema(
      client,
      registerTables([
        defineTable({
          domain: 'sync_engine',
          name: 'sync_engine_mutations',
          columns: {},
        }),
      ]),
      { ownership: 'declared-only' }
    );
    const schema = defineSchema({
      tables: { notes: { body: 'text' } },
    });
    await sqlite(schema, client, { ownership: 'declared-only' }).reconcile();
    const catalog = await readSqliteCatalog(client, schema._declared);
    expect(catalog.allTableNames.has('sync_engine_mutations')).toBe(true);
    expect(catalog.allTableNames.has('notes')).toBe(true);
  });
});
