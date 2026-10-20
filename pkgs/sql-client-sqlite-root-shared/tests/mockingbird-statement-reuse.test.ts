import { expect, spyOn, test } from 'bun:test';
import { Database } from '@crvouga/mockingbird-service-sqlite';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared/impl-mockingbird-sqlite';
import sql, { raw } from '@pkgs/sql-root-shared/sql';

// regression: mockingbird-sqlite-adapter-reparses-sql
test('repeated SQLite queries parse once and retain each new binding', async () => {
  const client = SqlClientImplMockingbirdSqlite.open();
  await client.connect();
  // Both spies call the real vendor engine; no query or result is replaced.
  const prepares = spyOn(Database.prototype, 'prepare');
  const queries = spyOn(Database.prototype, 'query');
  try {
    expect(
      await client.query(sql<{ value: number }>`SELECT ${41} AS value`)
    ).toEqual([{ value: 41 }]);
    expect(
      await client.query(sql<{ value: number }>`SELECT ${42} AS value`)
    ).toEqual([{ value: 42 }]);
    expect(prepares.mock.calls.length + queries.mock.calls.length).toBe(1);
  } finally {
    prepares.mockRestore();
    queries.mockRestore();
    await client.disconnect();
  }
});

test('a restored SQLite snapshot executes cached SQL against its replacement database', async () => {
  const client = SqlClientImplMockingbirdSqlite.open();
  await client.connect();
  const version = raw<{ user_version: number }>('PRAGMA user_version');
  try {
    await client.run(raw('PRAGMA user_version = 41'));
    const saved = client.exportDatabaseBytes();
    expect(await client.query(version)).toEqual([{ user_version: 41 }]);
    await client.run(raw('PRAGMA user_version = 42'));
    expect(await client.query(version)).toEqual([{ user_version: 42 }]);
    client.importDatabaseBytes(saved);
    expect(await client.query(version)).toEqual([{ user_version: 41 }]);
  } finally {
    await client.disconnect();
  }
});
