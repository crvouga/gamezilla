import { expect, test } from 'bun:test';
import {
  createPgSessionClient,
  pgQueryRows,
} from '@pkgs/sql-client-postgres-shared/impl-pg-shared';
import sql from '@pkgs/sql-shared/sql';

const result = {
  rows: [{ attempts: '0', large: '9007199254740993', label: '001' }],
  rowCount: 1,
  fields: [
    { name: 'attempts', dataTypeID: 20 },
    { name: 'large', dataTypeID: 20 },
    { name: 'label', dataTypeID: 25 },
  ],
};

// regression: postgres-session-string-attempts
test('transaction and prepared rows decode safe bigint strings without changing text or unsafe integers', async () => {
  const client = createPgSessionClient({ query: async () => result });
  const query = sql<{
    attempts: number;
    large: string;
    label: string;
  }>`SELECT attempts, large, label FROM outbox_deliveries`;
  for (const rows of [
    pgQueryRows(result),
    await client.query(query),
    await client.prepare(query).query(),
  ]) {
    expect(rows).toEqual([
      { attempts: 0, large: '9007199254740993', label: '001' },
    ]);
    expect(Number(rows[0]?.['attempts']) + 1).toBe(1);
  }
});
