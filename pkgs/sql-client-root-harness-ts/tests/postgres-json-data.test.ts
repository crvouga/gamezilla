import { expect, test } from 'bun:test';
import type { PostgresSqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { loadData } from '@pkgs/sql-client-root-shared-ts/port';
import { createPostgresDbScope } from '@pkgs/sql-client-root-shared-ts/postgres-db-scope';
import type { Value } from '@pkgs/sql-root-shared-ts/sql';

test('portable JSON array cells are bound as JSON rather than native SQL arrays', async () => {
  // regression: postgres-checkpoint-json-array
  const insertValues: Value[][] = [];
  const client = {
    dbScope: createPostgresDbScope('public'),
    query: async () => [{ column_name: 'choices', data_type: 'jsonb' }],
    run: async (query: { sql: string; values: Value[] }) => {
      if (query.sql.includes('INSERT INTO')) insertValues.push(query.values);
      return { changes: 1, lastInsertRowid: 0 };
    },
  } as unknown as PostgresSqlClient;
  await loadData(client, {
    version: 1,
    tables: {
      choices: {
        columns: ['id', 'choices'],
        rows: [['alice', ['e2e4', 'e7e5']]],
      },
    },
  });
  expect(insertValues).toEqual([['alice', '["e2e4","e7e5"]']]);
});
