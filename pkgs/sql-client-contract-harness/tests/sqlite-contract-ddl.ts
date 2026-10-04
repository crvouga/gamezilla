import { expect, test } from 'bun:test';
import { defineTable } from '@pkgs/db-schema-shared/define-table';
import sql, { raw } from '@pkgs/sql-shared/sql';
import type { SqliteClientGetter } from './sqlite-contract-helpers';
import { applySchema, expectQuery, setup } from './sqlite-contract-helpers';

export function registerSqliteDdlTests(getClient: SqliteClientGetter): void {
  test('PRAGMA user_version read/write', async () => {
    const client = getClient();
    await expectQuery(
      client,
      raw<{ user_version: number }>('PRAGMA user_version'),
      [{ user_version: 0 }]
    );
    await setup(client, [raw('PRAGMA user_version = 9001')]);
    await expectQuery(
      client,
      raw<{ user_version: number }>('PRAGMA user_version'),
      [{ user_version: 9001 }]
    );
  });

  test('STRICT / INDEX IF NOT EXISTS / table_info / sqlite_master', async () => {
    const client = getClient();
    const notesTable = defineTable({
      domain: 'notes',
      name: 'notes',
      columns: { body: 'text' },
      indexes: ['body'],
    });
    await applySchema(client, [notesTable]);
    await applySchema(client, [notesTable]);

    await expectQuery(
      client,
      raw<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
      ),
      [{ name: 'notes' }]
    );

    const mapInfo = (
      rows: { name: string; type: string; notnull: number; pk: number }[]
    ) =>
      rows.map(({ name, type, notnull, pk }) => ({ name, type, notnull, pk }));
    const infoQ = raw<{
      name: string;
      type: string;
      notnull: number;
      pk: number;
    }>('PRAGMA table_info("notes")');
    expect(mapInfo(await client.query(infoQ))).toEqual([
      { name: 'id', type: 'TEXT', notnull: 1, pk: 1 },
      { name: 'created_at', type: 'TEXT', notnull: 0, pk: 0 },
      { name: 'updated_at', type: 'TEXT', notnull: 0, pk: 0 },
      { name: 'deleted_at', type: 'TEXT', notnull: 0, pk: 0 },
      { name: 'body', type: 'TEXT', notnull: 0, pk: 0 },
    ]);

    const mapIx = (rows: { name: string; origin: string }[]) =>
      rows
        .filter((r) => !r.name.startsWith('sqlite_autoindex_'))
        .map(({ name, origin }) => ({ name, origin }));
    const ixListQ = raw<{ name: string; origin: string }>(
      'PRAGMA index_list("notes")'
    );
    const userIndexes = mapIx(await client.query(ixListQ));
    expect(userIndexes).toHaveLength(1);
    expect(userIndexes[0]?.origin).toBe('c');
    expect(userIndexes[0]?.name.startsWith('ix_notes_')).toBe(true);

    const mapIxInfo = (rows: { name: string }[]) =>
      rows.map(({ name }) => ({ name }));
    const ixInfoQ = raw<{ name: string }>(
      `PRAGMA index_info("${userIndexes[0]!.name}")`
    );
    expect(mapIxInfo(await client.query(ixInfoQ))).toEqual([{ name: 'body' }]);
  });

  test('DROP TABLE clears user indexes from catalog', async () => {
    const client = getClient();
    const notesTable = defineTable({
      domain: 'notes',
      name: 'notes',
      columns: { body: 'text' },
      indexes: ['body'],
    });
    await applySchema(client, [notesTable]);
    await setup(client, [raw('DROP TABLE notes')]);
    await applySchema(client, [notesTable]);

    const userIx = (rows: { name: string; origin: string }[]) =>
      rows
        .filter((r) => !r.name.startsWith('sqlite_autoindex_'))
        .map(({ name, origin }) => ({ name, origin }));
    const ixListQ = raw<{ name: string; origin: string }>(
      'PRAGMA index_list("notes")'
    );
    const indexes = userIx(await client.query(ixListQ));
    expect(indexes).toHaveLength(1);
    expect(indexes[0]?.origin).toBe('c');
    expect(indexes[0]?.name.startsWith('ix_notes_')).toBe(true);
  });

  test('quotes reserved column names (cursor, value)', async () => {
    const client = getClient();
    await applySchema(client, [
      defineTable({
        domain: 'inbox',
        name: 'inbox',
        columns: { cursor: 'text', value: 'text' },
      }),
    ]);
    await setup(client, [
      sql<void>`INSERT INTO inbox (id, cursor, value) VALUES (${'1'}, ${'c'}, ${'v'})`,
    ]);
    await expectQuery(
      client,
      raw<{ cursor: string; value: string }>('SELECT cursor, value FROM inbox'),
      [{ cursor: 'c', value: 'v' }]
    );
  });
}
