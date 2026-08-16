import { describe, expect, test } from 'bun:test';
import { raw, sql } from '@pkgs/sql';
import { SqlClientImplAlaSql } from '@pkgs/sql-client/sqlite/impl-alasql';

import { createTableChangeSqlClient } from '../../client/table-change-sql-client';
import { createTableChangeBus } from '../../queries/client/table-change-bus';

describe('createTableChangeSqlClient', () => {
  test('emits tables for INSERT via query(RETURNING *) inside a transaction', async () => {
    const rawClient = SqlClientImplAlaSql.open('table_change_returning');
    await rawClient.connect();
    await rawClient.run(
      raw('CREATE TABLE spaces (id TEXT PRIMARY KEY, title TEXT)')
    );
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
