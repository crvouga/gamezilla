import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';
import { defineTable, registerTables } from '@pkgs/db-schema';
import { createRecordingSqlClient } from '@pkgs/db-schema/test/fake-sql-client';
import { applySqliteSchema } from '@pkgs/db-schema-sqlite';
import { raw } from '@pkgs/sql';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite/impl-bun-sqlite';
import { readSqliteCatalog } from '../src/catalog';
import { sqlite } from '../src/driver';

function openMemoryClient() {
  const db = new Database(':memory:');
  const client = new SqlClientImplBunSqlite(db);
  return { db, client };
}

function notesSchema(
  columns: Record<string, 'text' | 'integer'>,
  options?: {
    readonly retiredColumns?: readonly {
      name: string;
      type: 'text' | 'integer';
      note: string;
    }[];
    readonly uniqueIndexes?: readonly (string | readonly string[])[];
  }
) {
  return registerTables([
    defineTable({
      domain: 'notes',
      name: 'notes',
      columns,
      ...(options?.retiredColumns !== undefined
        ? { retiredColumns: options.retiredColumns }
        : {}),
      ...(options?.uniqueIndexes !== undefined
        ? { uniqueIndexes: options.uniqueIndexes }
        : {}),
    }),
  ]);
}

describe('sqlite reconcile integration', () => {
  test('empty then reconcile twice is noop on second run', async () => {
    const { client } = openMemoryClient();
    const schema = notesSchema({ body: 'text', title: 'text' });

    await sqlite(schema, client).reconcile();

    const recording = createRecordingSqlClient(client);
    await sqlite(schema, recording).reconcile();
    expect(recording.runCalls.length).toBe(0);
  });

  test('accrete a column and reconcile', async () => {
    const { client } = openMemoryClient();
    const v1 = notesSchema({ body: 'text' });
    await sqlite(v1, client).reconcile();

    const v2 = notesSchema({ body: 'text', title: 'text' });
    await sqlite(v2, client).reconcile();

    const catalog = await readSqliteCatalog(client);
    expect(
      catalog.tables.get('notes')?.columns.some((c) => c.name === 'title')
    ).toBe(true);
  });

  test('preserves undeclared local columns and drops ghost tables when whole-db owned', async () => {
    const { client } = openMemoryClient();
    await applySqliteSchema(
      client,
      registerTables([
        defineTable({ domain: 'ghost', name: 'ghost', columns: {} }),
      ]),
      { ownership: 'declared-only' }
    );
    await sqlite(notesSchema({ body: 'text', extra: 'text' }), client, {
      ownership: 'declared-only',
    }).reconcile();
    await client.run(
      raw(`INSERT INTO notes (id, body, extra) VALUES ('1', 'hi', 'keep')`)
    );

    await sqlite(notesSchema({ body: 'text' }), client, {
      ownership: 'whole-db',
    }).reconcile();

    const row = await client.query<{ extra: string }>(
      raw(`SELECT extra FROM notes WHERE id = '1'`)
    );
    expect(row[0]?.extra).toBe('keep');
    const catalog = await readSqliteCatalog(client);
    expect(catalog.allTableNames.has('ghost')).toBe(false);
    expect(
      catalog.tables.get('notes')?.columns.some((c) => c.name === 'extra')
    ).toBe(true);
  });

  test('tombstoned column is dropped by row-preserving rebuild and then converges', async () => {
    const { client } = openMemoryClient();
    await sqlite(
      notesSchema({ body: 'text', old_field: 'text' }),
      client
    ).reconcile();
    await client.run(
      raw(
        `INSERT INTO notes (id, body, old_field) VALUES ('1', 'hi', 'remove')`
      )
    );

    const schema = notesSchema(
      { body: 'text' },
      {
        retiredColumns: [
          { name: 'old_field', type: 'text', note: 'no longer used' },
        ],
      }
    );
    await sqlite(schema, client).reconcile();
    const catalog = await readSqliteCatalog(client);
    expect(
      catalog.tables.get('notes')?.columns.some((c) => c.name === 'old_field')
    ).toBe(false);
    const rows = await client.query<{ id: string; body: string }>(
      raw(`SELECT id, body FROM notes`)
    );
    expect(rows).toEqual([{ id: '1', body: 'hi' }]);

    const recording = createRecordingSqlClient(client);
    await sqlite(schema, recording).reconcile();
    expect(recording.runCalls.length).toBe(0);
  });

  test('preserves _meta and its value across a rebuild', async () => {
    const { client } = openMemoryClient();
    await sqlite(
      notesSchema({ body: 'text', extra: 'text' }),
      client
    ).reconcile();
    await client.run(raw(`ALTER TABLE notes ADD COLUMN _meta TEXT`));
    await client.run(
      raw(
        `INSERT INTO notes (id, body, extra, _meta) VALUES ('1', 'hi', 'x', 'keep')`
      )
    );

    const schema = notesSchema(
      { body: 'text' },
      { retiredColumns: [{ name: 'extra', type: 'text', note: 'removed' }] }
    );
    await sqlite(schema, client).reconcile();

    const rows = await client.query<{ _meta: string }>(
      raw(`SELECT _meta FROM notes`)
    );
    expect(rows[0]?._meta).toBe('keep');
    const catalog = await readSqliteCatalog(client);
    expect(
      catalog.tables.get('notes')?.columns.some((c) => c.name === '_meta')
    ).toBe(true);
    expect(
      catalog.tables.get('notes')?.columns.some((c) => c.name === 'extra')
    ).toBe(false);
  });

  test('uniqueIndexes emit a UNIQUE INDEX', async () => {
    const { client } = openMemoryClient();
    const schema = notesSchema(
      { body: 'text', slug: 'text' },
      { uniqueIndexes: ['slug'] }
    );
    await sqlite(schema, client).reconcile();
    const catalog = await readSqliteCatalog(client);
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
    await sqlite(notesSchema({ body: 'text' }), client, {
      ownership: 'declared-only',
    }).reconcile();
    const catalog = await readSqliteCatalog(client);
    expect(catalog.allTableNames.has('sync_engine_mutations')).toBe(true);
    expect(catalog.allTableNames.has('notes')).toBe(true);
  });
});
