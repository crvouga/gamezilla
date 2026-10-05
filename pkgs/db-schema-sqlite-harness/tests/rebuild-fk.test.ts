import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';
import { defineTable } from '@pkgs/db-schema-root-shared/define-table';
import { registerTables } from '@pkgs/db-schema-root-shared/register-tables';
import { sqlite } from '@pkgs/db-schema-sqlite-shared/driver';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server/impl-bun-sqlite';
import { raw } from '@pkgs/sql-root-shared/sql';

function schemaWithNotes(oldField: boolean) {
  return registerTables([
    defineTable({
      domain: 'notes',
      name: 'notes',
      columns: oldField
        ? { body: 'text', old_field: 'text' }
        : { body: 'text' },
      ...(oldField
        ? {}
        : {
            retiredColumns: [
              { name: 'old_field', type: 'text' as const, note: 'removed' },
            ],
          }),
    }),
    defineTable({
      domain: 'legacy',
      name: 'legacy_notes',
      columns: { note_id: 'text' },
    }),
  ]);
}

describe('sqlite rebuild foreign keys', () => {
  test('rebuild keeps foreign keys targeting the live table', async () => {
    const db = new Database(':memory:');
    const client = new SqlClientImplBunSqlite(db);
    const v1 = schemaWithNotes(true);
    await sqlite(v1, client).reconcile();

    // The schema declaration owns the table and columns; add the legacy FK
    // constraint exactly as an existing host table would have been provisioned.
    await client.run(raw(`DROP TABLE legacy_notes`));
    await client.run(
      raw(
        `CREATE TABLE legacy_notes (id TEXT PRIMARY KEY, note_id TEXT REFERENCES notes (id)) STRICT`
      )
    );
    await client.run(
      raw(
        `INSERT INTO notes (id, body, old_field) VALUES ('n1', 'body', 'old')`
      )
    );
    await client.run(
      raw(`INSERT INTO legacy_notes (id, note_id) VALUES ('l1', 'n1')`)
    );

    await expect(
      sqlite(schemaWithNotes(false), client).reconcile()
    ).resolves.toBeUndefined();

    const foreignKeys = await client.query<{
      table: string;
      from: string;
      to: string;
    }>(raw(`PRAGMA foreign_key_list(legacy_notes)`));
    expect(
      foreignKeys.map(({ table, from, to }) => ({ table, from, to }))
    ).toEqual([{ table: 'notes', from: 'note_id', to: 'id' }]);
    const referencingRows = await client.query<{ id: string; note_id: string }>(
      raw(`SELECT id, note_id FROM legacy_notes`)
    );
    expect(referencingRows).toEqual([{ id: 'l1', note_id: 'n1' }]);
    const noteRows = await client.query<{ id: string; body: string }>(
      raw(`SELECT id, body FROM notes`)
    );
    expect(noteRows).toEqual([{ id: 'n1', body: 'body' }]);
  });
});
