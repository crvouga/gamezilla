import { afterEach, beforeEach, expect, test } from 'bun:test';
import { raw, sql } from '@pkgs/sql';
import type { SqlClient } from '../interface';
import { dumpData, loadData } from './port';

/** Shared dump→load round-trip — run against every SqlClient adapter. */
export function runSqlDataSnapshotContractTests(
  factory: () => SqlClient | Promise<SqlClient>
): void {
  let client: SqlClient;

  beforeEach(async () => {
    client = await Promise.resolve(factory());
    await client.connect();
  });

  afterEach(async () => {
    try {
      await client.disconnect();
    } catch {
      // already disconnected
    }
  });

  test('dumpData → loadData round-trip preserves rows', async () => {
    await client.run(
      raw(
        'CREATE TABLE IF NOT EXISTS snap_demo (id TEXT PRIMARY KEY, n INTEGER, body TEXT)'
      )
    );
    await client.run(
      sql`INSERT INTO snap_demo (id, n, body) VALUES (${'a'}, ${1}, ${'hello'})`
    );
    await client.run(
      sql`INSERT INTO snap_demo (id, n, body) VALUES (${'b'}, ${2}, ${'world'})`
    );

    const dump = await dumpData(client, { tables: ['snap_demo'] });
    await client.run(raw('DELETE FROM snap_demo'));
    expect(
      await client.query(
        raw<Record<string, unknown>>('SELECT * FROM snap_demo')
      )
    ).toEqual([]);

    await loadData(client, dump);
    const rows = await client.query<{ id: string; n: number; body: string }>(
      raw('SELECT id, n, body FROM snap_demo ORDER BY id')
    );
    expect(rows).toEqual([
      { id: 'a', n: 1, body: 'hello' },
      { id: 'b', n: 2, body: 'world' },
    ]);
  });

  test('dumpData → loadData preserves camelCase column names on Postgres', async () => {
    await client.run(
      raw(
        'CREATE TABLE IF NOT EXISTS snap_camel ("accountId" TEXT PRIMARY KEY, "createdAt" TEXT)'
      )
    );
    await client.run(
      raw(
        `INSERT INTO snap_camel ("accountId", "createdAt") VALUES ('acct-1', '2024-01-01')`
      )
    );

    const dump = await dumpData(client, { tables: ['snap_camel'] });
    expect(dump.tables['snap_camel']?.columns).toEqual([
      'accountId',
      'createdAt',
    ]);

    await client.run(raw('DELETE FROM snap_camel'));
    await loadData(client, dump);

    const rows = await client.query<{ accountId: string; createdAt: string }>(
      raw('SELECT "accountId", "createdAt" FROM snap_camel')
    );
    expect(rows).toEqual([{ accountId: 'acct-1', createdAt: '2024-01-01' }]);
  });
}
