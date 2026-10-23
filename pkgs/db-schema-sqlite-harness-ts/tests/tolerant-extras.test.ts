import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';
import { defineTable } from '@pkgs/db-schema-root-shared-ts/define-table';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import { sqlite } from '@pkgs/db-schema-sqlite-shared-ts/driver';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import { raw } from '@pkgs/sql-root-shared-ts/sql';

function notesSchema(columns: Record<string, 'text'>) {
  return registerTables([
    defineTable({ domain: 'notes', name: 'notes', columns }),
  ]);
}

describe('sqlite tolerant extras', () => {
  test('stale schema preserves newer declared columns and every row', async () => {
    const db = new Database(':memory:');
    const client = new SqlClientImplBunSqlite(db);
    const v2 = notesSchema({ body: 'text', title: 'text' });
    await sqlite(v2, client).reconcile();
    await client.run(
      raw(
        `INSERT INTO notes (id, body, title) VALUES ('first', 'body-1', 'title-1'), ('second', 'body-2', 'title-2')`
      )
    );

    const v1 = notesSchema({ body: 'text' });
    await expect(sqlite(v1, client).reconcile()).resolves.toBeUndefined();

    const rows = await client.query<{
      id: string;
      body: string;
      title: string;
    }>(raw(`SELECT id, body, title FROM notes ORDER BY id`));
    expect(rows).toEqual([
      { id: 'first', body: 'body-1', title: 'title-1' },
      { id: 'second', body: 'body-2', title: 'title-2' },
    ]);
  });
});
