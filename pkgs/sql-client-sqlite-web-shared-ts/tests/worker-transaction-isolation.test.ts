import { expect, test } from 'bun:test';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import type {
  SqliteWorkerOps,
  SqliteWorkerRequest,
} from '@pkgs/sql-client-sqlite-web-shared-ts/protocol';
import {
  createSqliteWorkerSqlClient,
  type SqliteWorkerRpc,
} from '@pkgs/sql-client-sqlite-web-shared-ts/sqlite-worker-client';
import { createSqliteWorkerHost } from '@pkgs/sql-client-sqlite-web-shared-ts/sqlite-worker-host';
import sql, { raw } from '@pkgs/sql-root-shared-ts/sql';

// regression: sqlite-read-sees-intermediate-transaction
test('the worker client keeps concurrent reads outside an unfinished transaction', async () => {
  const db = SqlClientImplMockingbirdSqlite.open({ seed: 1 });
  const host = createSqliteWorkerHost({
    open: async () => ({ db, persistent: false, vfs: 'memory' }),
    wipe: async () => {},
  });
  let requestId = 0;
  const rpc: SqliteWorkerRpc = {
    request: async (op, args) => {
      const response = await host.handle({
        id: `isolation-${++requestId}`,
        op,
        args,
      } as SqliteWorkerRequest);
      if (!response.ok) throw new Error(response.error.message);
      return response.result as SqliteWorkerOps[typeof op]['result'];
    },
    abortAll: () => {},
  };
  await rpc.request('open', { dbName: 'isolation-example' });
  const client = createSqliteWorkerSqlClient({
    rpc,
    onDisconnect: () => host.dispose(),
  });
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let writer: Promise<void> | undefined;
  try {
    await client.run(
      raw(
        'CREATE TABLE isolation_example (id TEXT PRIMARY KEY, n INTEGER NOT NULL)'
      )
    );
    await client.run(
      sql`INSERT INTO isolation_example (id, n) VALUES (${'position'}, ${31})`
    );
    writer = client.transaction(async (tx) => {
      await tx.run(
        sql`UPDATE isolation_example SET n = ${4} WHERE id = ${'position'}`
      );
      entered.resolve();
      await release.promise;
      await tx.run(
        sql`UPDATE isolation_example SET n = ${31} WHERE id = ${'position'}`
      );
    });
    await entered.promise;
    const read = client.query(
      sql<{
        n: number;
      }>`SELECT n FROM isolation_example WHERE id = ${'position'}`
    );
    release.resolve();
    await writer;
    expect(await read).toEqual([{ n: 31 }]);
  } finally {
    release.resolve();
    await writer;
    await client.disconnect();
  }
});
