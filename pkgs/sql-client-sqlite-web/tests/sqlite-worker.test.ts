import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { sql } from '@pkgs/sql';
import {
  attachSqliteWorkerHost,
  createMemorySqliteWorkerBackend,
  createSqliteWorkerHost,
  createSqliteWorkerRpc,
  createSqliteWorkerSqlClient,
  createSqliteWorkerSqlOwner,
  MEMORY_VFS_NAME,
  type Sqlite3Static,
  type SqliteWorkerBackend,
  type SqliteWorkerHandle,
  type SqliteWorkerPort,
} from '@pkgs/sql-client-sqlite-web/sqlite-worker';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

let sqlite3: Sqlite3Static;

beforeAll(async () => {
  sqlite3 = await sqlite3InitModule();
});

/** Two ends of an in-process "worker": host on port2, caller on port1. */
function createFakeWorker(
  backend: SqliteWorkerBackend,
  onTerminate?: () => void
): SqliteWorkerHandle {
  const channel = new MessageChannel();
  const host = createSqliteWorkerHost(backend);
  const hostPort = channel.port2 as unknown as SqliteWorkerPort;
  const detach = attachSqliteWorkerHost(hostPort, host);
  const callerPort = channel.port1;
  callerPort.start();
  channel.port2.start();
  return {
    postMessage: (message) => callerPort.postMessage(message),
    get onmessage() {
      return callerPort.onmessage as SqliteWorkerHandle['onmessage'];
    },
    set onmessage(handler) {
      callerPort.onmessage = handler as typeof callerPort.onmessage;
    },
    terminate: () => {
      detach();
      void host.dispose();
      callerPort.close();
      channel.port2.close();
      onTerminate?.();
    },
  };
}

/**
 * `expect(promise).rejects` stalls under bun test when the rejection settles
 * after MessagePort turns; await the failure explicitly instead.
 */
async function rejectionOf(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error: unknown) {
    return error instanceof Error ? error : new Error(String(error));
  }
  throw new Error('expected promise to reject');
}

const allHandles: SqliteWorkerHandle[] = [];
afterAll(() => {
  for (const handle of allHandles) handle.terminate();
});

describe('sqlite worker protocol (memory backend)', () => {
  test('open → run → query round-trips rows over the port', async () => {
    const handle = createFakeWorker(createMemorySqliteWorkerBackend(sqlite3));
    allHandles.push(handle);
    const rpc = createSqliteWorkerRpc(handle);
    const opened = await rpc.request('open', { dbName: 'user_test' });
    expect(opened).toEqual({ persistent: false, vfs: MEMORY_VFS_NAME });

    const client = createSqliteWorkerSqlClient({
      rpc,
      onDisconnect: () => Promise.resolve(),
    });
    await client.run(sql`CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)`);
    const inserted = await client.run(
      sql`INSERT INTO t (name) VALUES (${'a'})`
    );
    expect(inserted).toEqual({ changes: 1, lastInsertRowid: 1 });
    const rows = await client.query<{ id: number; name: string }>(
      sql`SELECT id, name FROM t`
    );
    expect(rows).toEqual([{ id: 1, name: 'a' }]);
  });

  test('errors are rehydrated on the caller side', async () => {
    const handle = createFakeWorker(createMemorySqliteWorkerBackend(sqlite3));
    allHandles.push(handle);
    const rpc = createSqliteWorkerRpc(handle);
    const notOpen = await rejectionOf(
      rpc.request('query', { sql: 'SELECT 1', values: [] })
    );
    expect(notOpen.message).toMatch(/not open/);
    await rpc.request('open', { dbName: 'user_test' });
    const missing = await rejectionOf(
      rpc.request('query', { sql: 'SELECT * FROM missing', values: [] })
    );
    expect(missing.message).toMatch(/no such table/);
  });

  test('transaction rolls back on failure and commits on success', async () => {
    const handle = createFakeWorker(createMemorySqliteWorkerBackend(sqlite3));
    allHandles.push(handle);
    const rpc = createSqliteWorkerRpc(handle);
    await rpc.request('open', { dbName: 'user_test' });
    const client = createSqliteWorkerSqlClient({
      rpc,
      onDisconnect: () => Promise.resolve(),
    });
    await client.run(sql`CREATE TABLE t (id INTEGER PRIMARY KEY)`);

    const failed = await rejectionOf(
      client.transaction(async (tx) => {
        await tx.run(sql`INSERT INTO t (id) VALUES (1)`);
        throw new Error('boom');
      })
    );
    expect(failed.message).toBe('boom');
    expect(await client.query(sql<{ id: number }>`SELECT id FROM t`)).toEqual(
      []
    );

    await client.transaction(async (tx) => {
      await tx.run(sql`INSERT INTO t (id) VALUES (2)`);
    });
    expect(await client.query(sql<{ id: number }>`SELECT id FROM t`)).toEqual([
      { id: 2 },
    ]);
  });

  test('prepared statements bind per-call params', async () => {
    const handle = createFakeWorker(createMemorySqliteWorkerBackend(sqlite3));
    allHandles.push(handle);
    const rpc = createSqliteWorkerRpc(handle);
    await rpc.request('open', { dbName: 'user_test' });
    const client = createSqliteWorkerSqlClient({
      rpc,
      onDisconnect: () => Promise.resolve(),
    });
    await client.run(sql`CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)`);
    const insert = client.prepare(
      sql<Record<string, unknown>>`INSERT INTO t (v) VALUES (${'unused'})`
    );
    await insert.run(['x']);
    await insert.run(['y']);
    const select = client.prepare<{ v: string }>(
      sql`SELECT v FROM t WHERE v = ${'unused'}`
    );
    expect(await select.query(['y'])).toEqual([{ v: 'y' }]);
  });

  test('export / import move a byte image across connections', async () => {
    const handle = createFakeWorker(createMemorySqliteWorkerBackend(sqlite3));
    allHandles.push(handle);
    const rpc = createSqliteWorkerRpc(handle);
    await rpc.request('open', { dbName: 'user_test' });
    const client = createSqliteWorkerSqlClient({
      rpc,
      onDisconnect: () => Promise.resolve(),
    });
    await client.run(sql`CREATE TABLE t (id INTEGER PRIMARY KEY)`);
    await client.run(sql`INSERT INTO t (id) VALUES (7)`);
    const image = await client.exportDatabaseBytesAsync();
    expect(image.byteLength).toBeGreaterThan(0);

    await client.run(sql`DELETE FROM t`);
    expect(await client.query(sql<{ id: number }>`SELECT id FROM t`)).toEqual(
      []
    );
    await client.importDatabaseBytesAsync(image);
    expect(await client.query(sql<{ id: number }>`SELECT id FROM t`)).toEqual([
      { id: 7 },
    ]);
  });

  test('requests are served strictly in order', async () => {
    const handle = createFakeWorker(createMemorySqliteWorkerBackend(sqlite3));
    allHandles.push(handle);
    const rpc = createSqliteWorkerRpc(handle);
    await rpc.request('open', { dbName: 'user_test' });
    const results = await Promise.all([
      rpc.request('run', { sql: 'CREATE TABLE t (id INTEGER)', values: [] }),
      rpc.request('run', { sql: 'INSERT INTO t VALUES (1)', values: [] }),
      rpc.request('query', { sql: 'SELECT id FROM t', values: [] }),
    ]);
    expect(results[2]).toEqual([{ id: 1 }]);
  });
});

describe('createSqliteWorkerSqlOwner', () => {
  function createTrackedSpawner(backend: SqliteWorkerBackend) {
    const events: string[] = [];
    const spawnWorker = (dbName: string): SqliteWorkerHandle => {
      events.push(`spawn:${dbName}`);
      const handle = createFakeWorker(backend, () => {
        events.push('terminate');
      });
      allHandles.push(handle);
      return handle;
    };
    return { events, spawnWorker };
  }

  test('open spawns one worker; close terminates it', async () => {
    const { events, spawnWorker } = createTrackedSpawner(
      createMemorySqliteWorkerBackend(sqlite3)
    );
    const owner = createSqliteWorkerSqlOwner({ dbName: 'user_a', spawnWorker });
    expect(owner.getOpenInfo()).toBeNull();

    const client = await owner.open();
    expect(owner.getOpenInfo()).toEqual({
      persistent: false,
      vfs: MEMORY_VFS_NAME,
    });
    await client.run(sql`CREATE TABLE t (id INTEGER)`);
    expect(events).toEqual(['spawn:user_a']);

    await owner.close();
    expect(owner.getOpenInfo()).toBeNull();
    expect(events).toEqual(['spawn:user_a', 'terminate']);
    await owner.close();
    expect(events).toEqual(['spawn:user_a', 'terminate']);
  });

  test('client.disconnect closes the owner', async () => {
    const { events, spawnWorker } = createTrackedSpawner(
      createMemorySqliteWorkerBackend(sqlite3)
    );
    const owner = createSqliteWorkerSqlOwner({ dbName: 'user_a', spawnWorker });
    const client = await owner.open();
    await client.disconnect();
    expect(events).toEqual(['spawn:user_a', 'terminate']);
  });

  test('reopen replaces the live worker', async () => {
    const { events, spawnWorker } = createTrackedSpawner(
      createMemorySqliteWorkerBackend(sqlite3)
    );
    const owner = createSqliteWorkerSqlOwner({ dbName: 'user_a', spawnWorker });
    await owner.open();
    await owner.open();
    expect(events).toEqual(['spawn:user_a', 'terminate', 'spawn:user_a']);
    await owner.close();
  });

  test('resetStore wipes through a throwaway worker', async () => {
    const wiped: string[] = [];
    const memory = createMemorySqliteWorkerBackend(sqlite3);
    const backend: SqliteWorkerBackend = {
      open: memory.open,
      wipe: (dbName) => {
        wiped.push(dbName);
        return Promise.resolve();
      },
    };
    const { events, spawnWorker } = createTrackedSpawner(backend);
    const owner = createSqliteWorkerSqlOwner({ dbName: 'user_a', spawnWorker });
    await owner.open();
    await owner.resetStore();
    expect(wiped).toEqual(['user_a']);
    expect(events).toEqual([
      'spawn:user_a',
      'terminate',
      'spawn:user_a',
      'terminate',
    ]);
    expect(owner.getOpenInfo()).toBeNull();
  });

  test('open failure terminates the worker and rethrows', async () => {
    const backend: SqliteWorkerBackend = {
      open: () => Promise.reject(new Error('cannot create file')),
      wipe: () => Promise.resolve(),
    };
    const { events, spawnWorker } = createTrackedSpawner(backend);
    const owner = createSqliteWorkerSqlOwner({ dbName: 'user_a', spawnWorker });
    const failed = await rejectionOf(owner.open());
    expect(failed.message).toBe('cannot create file');
    expect(events).toEqual(['spawn:user_a', 'terminate']);
    expect(owner.getOpenInfo()).toBeNull();
  });
});
