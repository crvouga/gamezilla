import { describe, expect, test } from 'bun:test';
import { defineTable, registerTables } from '@pkgs/db-schema';
import { applySqliteSchema } from '@pkgs/db-schema/sqlite';
import { raw, sql } from '@pkgs/sql';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client/sqlite/impl-sqlite-mem';

import { createTableChangeSqlClient } from '../../client/table-change-sql-client';
import { createTableChangeBus } from '../../queries/client/table-change-bus';

const spacesSchema = registerTables([
  defineTable({
    domain: 'spaces',
    name: 'spaces',
    columns: { title: 'text' },
  }),
]);

describe('createTableChangeSqlClient', () => {
  test('emits tables for INSERT via query(RETURNING *) inside a transaction', async () => {
    const rawClient = SqlClientImplSqliteMem.open();
    await rawClient.connect();
    await applySqliteSchema(rawClient, spacesSchema);
    const bus = createTableChangeBus();
    const emitted: string[][] = [];
    bus.subscribe((tables) => {
      emitted.push([...tables].sort());
    });
    const db = createTableChangeSqlClient(rawClient, bus);

    await db.transaction(async (tx) => {
      await tx.query(sql<{ id: string; title: string }>`
        INSERT INTO spaces (id, title) VALUES (${'s1'}, ${'hello'})
        RETURNING *
      `);
    });

    expect(emitted).toEqual([['spaces']]);
    const rows = await rawClient.query(
      raw<{ id: string }>('SELECT id FROM spaces')
    );
    expect(rows).toEqual([{ id: 's1' }]);
    await rawClient.disconnect();
  });
});
