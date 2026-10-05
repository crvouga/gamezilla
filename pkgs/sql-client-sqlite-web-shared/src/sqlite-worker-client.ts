import type {
  PreparedStatement,
  RunResult,
  SqlClient,
} from '@pkgs/sql-client-root-shared/interface';
import type { Sql, Value } from '@pkgs/sql-root-shared/sql';
import type {
  SqliteWorkerOp,
  SqliteWorkerOps,
  SqliteWorkerPort,
  SqliteWorkerRequest,
} from './protocol';
import { isSqliteWorkerResponse } from './protocol';
import { createRpcIdFactory, rehydrateError, serializeSql } from './rpc';

export type SqliteWorkerRpc = {
  request: <O extends SqliteWorkerOp>(
    op: O,
    args: SqliteWorkerOps[O]['args']
  ) => Promise<SqliteWorkerOps[O]['result']>;
  /** Reject every in-flight request (worker terminated). */
  abortAll: (reason: Error) => void;
};

type Pending = {
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: Error) => void;
};

/** Promise RPC over a {@link SqliteWorkerPort} (the owner-tab side). */
export function createSqliteWorkerRpc(port: SqliteWorkerPort): SqliteWorkerRpc {
  const pending = new Map<string, Pending>();
  const nextId = createRpcIdFactory('sqlw');

  port.onmessage = (event) => {
    const data = event.data;
    if (!isSqliteWorkerResponse(data)) return;
    const entry = pending.get(data.id);
    if (entry === undefined) return;
    pending.delete(data.id);
    if (data.ok) {
      entry.resolve(data.result);
    } else {
      entry.reject(rehydrateError(data.error));
    }
  };

  return {
    request: (op, args) =>
      new Promise((resolve, reject) => {
        const id = nextId();
        pending.set(id, {
          resolve: resolve as (value: unknown) => void,
          reject,
        });
        const request: SqliteWorkerRequest = { id, op, args };
        port.postMessage(request);
      }),
    abortAll: (reason) => {
      for (const [, entry] of pending) entry.reject(reason);
      pending.clear();
    },
  };
}

/**
 * Worker-backed {@link SqlClient} with async byte export / import.
 * Transactions are flattened (`fn(this)`), matching the other web owners.
 */
export type SqliteWorkerSqlClient = SqlClient & {
  exportDatabaseBytesAsync: () => Promise<Uint8Array>;
  importDatabaseBytesAsync: (bytes: Uint8Array) => Promise<void>;
};

function toRunResult(result: RunResult): RunResult {
  return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
}

export function createSqliteWorkerSqlClient(args: {
  readonly rpc: SqliteWorkerRpc;
  readonly onDisconnect: () => Promise<void>;
}): SqliteWorkerSqlClient {
  const { rpc } = args;
  const client: SqliteWorkerSqlClient = {
    connect: () => Promise.resolve(),
    disconnect: () => args.onDisconnect(),
    query: <T extends Record<string, unknown>>(query: Sql<T>) =>
      rpc.request('query', serializeSql(query)) as Promise<T[]>,
    run: async (query: Sql<unknown>) =>
      toRunResult(await rpc.request('run', serializeSql(query))),
    prepare: <T extends Record<string, unknown>>(
      query: Sql<T>
    ): PreparedStatement<T> => ({
      query: (params?: Value[]) =>
        rpc.request('query', {
          sql: query.sql,
          values: params ?? query.values,
        }) as Promise<T[]>,
      run: async (params?: Value[]) =>
        toRunResult(
          await rpc.request('run', {
            sql: query.sql,
            values: params ?? query.values,
          })
        ),
    }),
    transaction: async <T>(fn: (tx: SqlClient) => Promise<T>) => {
      await rpc.request('run', { sql: 'BEGIN', values: [] });
      try {
        const result = await fn(client);
        await rpc.request('run', { sql: 'COMMIT', values: [] });
        return result;
      } catch (error: unknown) {
        try {
          await rpc.request('run', { sql: 'ROLLBACK', values: [] });
        } catch {
          // preserve the original failure
        }
        throw error;
      }
    },
    exportDatabaseBytesAsync: () => rpc.request('exportBytes', {}),
    importDatabaseBytesAsync: async (bytes) => {
      await rpc.request('importBytes', { bytes });
    },
  };
  return client;
}
