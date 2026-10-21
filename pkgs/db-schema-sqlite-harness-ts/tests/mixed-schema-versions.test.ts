import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';
import { defineTable } from '@pkgs/db-schema-root-shared-ts/define-table';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import { readSqliteCatalog } from '@pkgs/db-schema-sqlite-shared-ts/catalog';
import { sqlite } from '@pkgs/db-schema-sqlite-shared-ts/driver';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import { raw } from '@pkgs/sql-root-shared-ts/sql';

function schema(args: {
  readonly title?: boolean;
  readonly summary?: boolean;
  readonly retireTitle?: boolean;
}) {
  return registerTables([
    defineTable({
      domain: 'notes',
      name: 'notes',
      columns: {
        body: 'text',
        ...(args.title ? { title: 'text' as const } : {}),
        ...(args.summary ? { summary: 'text' as const } : {}),
      },
      ...(args.retireTitle
        ? {
            retiredColumns: [
              { name: 'title', type: 'text' as const, note: 'removed' },
            ],
          }
        : {}),
    }),
  ]);
}

describe('sqlite mixed schema versions', () => {
  test('one file remains readable through v1, v2, v1, and v3', async () => {
    const db = new Database(':memory:');
    const client = new SqlClientImplBunSqlite(db);
    const v1 = schema({});
    const v2 = schema({ title: true });
    const v3 = schema({ summary: true, retireTitle: true });

    await expect(sqlite(v1, client).reconcile()).resolves.toBeUndefined();
    await client.run(
      raw(`INSERT INTO notes (id, body) VALUES ('v1', 'body-v1')`)
    );
    let rows = await client.query<{ id: string; body: string }>(
      raw(`SELECT id, body FROM notes`)
    );
    expect(rows).toEqual([{ id: 'v1', body: 'body-v1' }]);

    await expect(sqlite(v2, client).reconcile()).resolves.toBeUndefined();
    await client.run(
      raw(
        `INSERT INTO notes (id, body, title) VALUES ('v2', 'body-v2', 'title-v2')`
      )
    );
    rows = await client.query<{ id: string; body: string }>(
      raw(`SELECT id, body FROM notes ORDER BY id`)
    );
    expect(rows).toEqual([
      { id: 'v1', body: 'body-v1' },
      { id: 'v2', body: 'body-v2' },
    ]);
    const withTitle = await client.query<{ id: string; title: string | null }>(
      raw(`SELECT id, title FROM notes ORDER BY id`)
    );
    expect(withTitle).toEqual([
      { id: 'v1', title: null },
      { id: 'v2', title: 'title-v2' },
    ]);

    await expect(sqlite(v1, client).reconcile()).resolves.toBeUndefined();
    const afterStale = await client.query<{
      id: string;
      body: string;
      title: string | null;
    }>(raw(`SELECT id, body, title FROM notes ORDER BY id`));
    expect(afterStale).toEqual([
      { id: 'v1', body: 'body-v1', title: null },
      { id: 'v2', body: 'body-v2', title: 'title-v2' },
    ]);

    await expect(sqlite(v3, client).reconcile()).resolves.toBeUndefined();
    await client.run(
      raw(
        `INSERT INTO notes (id, body, summary) VALUES ('v3', 'body-v3', 'summary-v3')`
      )
    );
    const finalRows = await client.query<{
      id: string;
      body: string;
      summary: string | null;
    }>(raw(`SELECT id, body, summary FROM notes ORDER BY id`));
    expect(finalRows).toEqual([
      { id: 'v1', body: 'body-v1', summary: null },
      { id: 'v2', body: 'body-v2', summary: null },
      { id: 'v3', body: 'body-v3', summary: 'summary-v3' },
    ]);
    const catalog = await readSqliteCatalog(client);
    const names = catalog.tables
      .get('notes')
      ?.columns.map((column) => column.name);
    expect(names).toContain('body');
    expect(names).toContain('summary');
    expect(names).not.toContain('title');
  });
});
