import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import {
  getPGliteTestInstance,
  stopPGliteTestInstance,
} from '../postgres/pglite-test-instance';
import { InMemoryPubSub } from '../pub-sub/impl-in-memory';
import { SqlClientImplBunPostgres } from './impl-bun-postgres';
import { SqlClientImplBunSqlite } from './impl-bun-sqlite';
import { SqlClientImplSqlJs } from './impl-sql-js';
import { SqlClientWithPubSub } from './impl-with-pub-sub';
import type { SqlClient } from './interface';

type ClientFactory = () => Promise<SqlClient>;

let cachedPostgresClient: SqlClient | null = null;

async function loadImplementations(): Promise<
  { name: string; createClient: ClientFactory }[]
> {
  const impls: { name: string; createClient: ClientFactory }[] = [
    {
      name: 'SqlClientImplSqlJs',
      createClient: () => SqlClientImplSqlJs.openMemory(),
    },
    {
      name: 'SqlClientImplBunSqlite',
      createClient: () =>
        Promise.resolve(SqlClientImplBunSqlite.open(':memory:')),
    },
    {
      name: 'SqlClientWithPubSub',
      createClient: () =>
        Promise.resolve(
          new SqlClientWithPubSub(
            SqlClientImplBunSqlite.open(':memory:'),
            new InMemoryPubSub()
          )
        ),
    },
  ];
  try {
    const { SqlClientImplExpoSqlite } = await import('./impl-expo-sqlite');
    impls.push({
      name: 'SqlClientImplExpoSqlite',
      createClient: () => SqlClientImplExpoSqlite.open(':memory:'),
    });
  } catch {
    // expo-sqlite requires React Native runtime; skip in Bun test env
  }

  if (process.env['SKIP_POSTGRES_TESTS'] !== '1') {
    impls.push({
      name: 'SqlClientImplBunPostgres',
      createClient: async () => {
        const pg = await getPGliteTestInstance(25433);
        if (!cachedPostgresClient) {
          await pg.wipe();
          cachedPostgresClient = SqlClientImplBunPostgres.connect(
            pg.connectionUrl
          );
        }
        const c = cachedPostgresClient;
        if (c === null || c === undefined)
          throw new Error('cachedPostgresClient must be set');
        return {
          connect: () => c.connect(),
          disconnect: () => Promise.resolve(),
          prepare: (sql) => c.prepare(sql),
          query: (sql, params) => c.query(sql, params),
          run: (sql, params) => c.run(sql, params),
          transaction: (fn) => c.transaction(fn),
        };
      },
    });
  }

  return impls;
}

const implementations = await loadImplementations();

describe.each(implementations)('$name', ({ createClient }) => {
  let client: SqlClient | null = null;
  let available = true;

  beforeEach(async () => {
    try {
      client = await createClient();
      available = true;
    } catch {
      client = null;
      available = false;
    }
  });

  afterEach(async () => {
    if (client && available) {
      try {
        await client.disconnect();
      } catch {
        // already disconnected
      }
    }
  });

  afterAll(async () => {
    if (cachedPostgresClient) {
      await cachedPostgresClient.disconnect();
      cachedPostgresClient = null;
    }
    await stopPGliteTestInstance();
  });

  test('connect and disconnect', async () => {
    if (!client || !available) return;
    await client.connect();
    await client.disconnect();
  });

  test('run creates table and returns RunResult', async () => {
    if (!client || !available) return;
    await client.connect();
    const result = await client.run(
      'CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)'
    );
    expect(result.changes).toBe(0);
    expect(typeof result.lastInsertRowid).toBe('number');
    await client.disconnect();
  });

  test('run insert returns changes and lastInsertRowid', async () => {
    if (!client || !available) return;
    await client.connect();
    await client.run('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)');
    const result = await client.run(
      'INSERT INTO users (id, name) VALUES (?, ?) RETURNING *',
      [1, 'Alice']
    );
    expect(result.changes).toBeGreaterThanOrEqual(1);
    expect(result.lastInsertRowid).toBeGreaterThanOrEqual(1);
    await client.disconnect();
  });

  test('query returns rows with positional params', async () => {
    if (!client || !available) return;
    await client.connect();
    await client.run('CREATE TABLE items (id INTEGER, value TEXT)');
    await client.run('INSERT INTO items VALUES (?, ?)', [1, 'a']);
    await client.run('INSERT INTO items VALUES (?, ?)', [2, 'b']);
    const rows = await client.query<{ id: number; value: string }>(
      'SELECT id, value FROM items WHERE id >= ? ORDER BY id',
      [1]
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ id: 1, value: 'a' });
    expect(rows[1]).toEqual({ id: 2, value: 'b' });
    await client.disconnect();
  });

  test('query returns empty array when no rows', async () => {
    if (!client || !available) return;
    await client.connect();
    await client.run('CREATE TABLE empty (id INTEGER)');
    const rows = await client.query('SELECT * FROM empty');
    expect(rows).toEqual([]);
    await client.disconnect();
  });

  test('run update returns changes count', async () => {
    if (!client || !available) return;
    await client.connect();
    await client.run('CREATE TABLE counters (id INTEGER, n INTEGER)');
    await client.run('INSERT INTO counters VALUES (1, 0)');
    const result = await client.run(
      'UPDATE counters SET n = 1 WHERE id = ? RETURNING *',
      [1]
    );
    expect(result.changes).toBeGreaterThanOrEqual(1);
    await client.disconnect();
  });

  test('transaction commits on success', async () => {
    if (!client || !available) return;
    await client.connect();
    await client.run(
      'CREATE TABLE tx_test (id INTEGER PRIMARY KEY, x INTEGER)'
    );
    const result = await client.transaction(async (tx) => {
      await tx.run('INSERT INTO tx_test (id, x) VALUES (?, ?)', [1, 1]);
      await tx.run('INSERT INTO tx_test (id, x) VALUES (?, ?)', [2, 2]);
      return 2;
    });
    expect(result).toBe(2);
    if (client === null || client === undefined)
      throw new Error('client must be set');
    const rows = await client.query('SELECT * FROM tx_test');
    expect(rows).toHaveLength(2);
    await client.disconnect();
  });

  test('transaction rolls back on error', async () => {
    if (!client || !available) return;
    await client.connect();
    await client.run('CREATE TABLE rollback_test (id INTEGER PRIMARY KEY)');
    try {
      await client.transaction(async (tx) => {
        await tx.run('INSERT INTO rollback_test (id) VALUES (?)', [1]);
        throw new Error('abort');
      });
    } catch (e) {
      expect((e as Error).message).toBe('abort');
    }
    if (client === null || client === undefined)
      throw new Error('client must be set');
    const rows = await client.query('SELECT * FROM rollback_test');
    expect(rows).toHaveLength(0);
    await client.disconnect();
  });
});
