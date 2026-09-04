/**
 * Main-thread proxy: SqlClient + Pool over a PGlite worker thread.
 * Used on Node (Jest) so WASM dynamic import runs with
 * `--experimental-vm-modules` without poisoning the Jest VM.
 */

import { createRequire } from 'node:module';
import { Worker } from 'node:worker_threads';
import type { Sql, Value } from '@pkgs/sql';
import type { PreparedStatement, RunResult, SqlClient } from '../interface';
import { questionMarkParamsToDollarParams } from '../positional-params';
import type { Pool, PoolClient, QueryResult } from './pg-types';

type WorkerReply =
  | { readonly id: number; readonly result: unknown }
  | { readonly id: number; readonly error: string };

function resolveWorkerEntry(): string {
  // Prefer sibling .cjs next to this module (works under Jest + tsx + bun).
  const { join } = require('node:path') as typeof import('node:path');
  return join(__dirname, 'pglite-worker-host.cjs');
}

export type PgliteWorkerBundle = {
  readonly sqlClient: SqlClient;
  readonly pool: Pool;
  disconnect(): Promise<void>;
  exportBytes(): Promise<Uint8Array>;
  replaceFromBytes(bytes: Uint8Array): Promise<void>;
};

export async function openPgliteWorkerSqlClient(args?: {
  readonly seedBytes?: Uint8Array;
}): Promise<PgliteWorkerBundle> {
  const worker = new Worker(resolveWorkerEntry(), {
    execArgv: ['--experimental-vm-modules'],
  });

  let nextId = 1;
  const pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (err: Error) => void;
    }
  >();

  worker.on('message', (msg: WorkerReply) => {
    const slot = pending.get(msg.id);
    if (slot === undefined) return;
    pending.delete(msg.id);
    if ('error' in msg) {
      slot.reject(new Error(msg.error));
      return;
    }
    slot.resolve(msg.result);
  });

  worker.on('error', (err) => {
    for (const slot of pending.values()) {
      slot.reject(err instanceof Error ? err : new Error(String(err)));
    }
    pending.clear();
  });

  const call = (
    op: string,
    extra?: Record<string, unknown>
  ): Promise<unknown> => {
    const id = nextId;
    nextId += 1;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, op, ...extra });
    });
  };

  await call('create', {
    ...(args?.seedBytes !== undefined
      ? { seedB64: Buffer.from(args.seedBytes).toString('base64') }
      : {}),
  });

  const runQuery = async (
    sqlText: string,
    params?: readonly unknown[]
  ): Promise<{ rows: unknown[]; affectedRows: number }> => {
    const [text, vals] = questionMarkParamsToDollarParams(sqlText, params);
    const result = (await call('query', {
      sql: text,
      params: vals,
    })) as { rows: unknown[]; affectedRows: number };
    return result;
  };

  const sqlClient: SqlClient = {
    connect: async () => undefined,
    disconnect: async () => {
      await call('close');
      await worker.terminate();
    },
    async query<T extends Record<string, unknown>>(
      query: Sql<T>
    ): Promise<T[]> {
      const result = await runQuery(query.sql, query.values);
      return result.rows as T[];
    },
    async run(query: Sql<unknown>): Promise<RunResult> {
      const result = await runQuery(query.sql, query.values);
      return { changes: result.affectedRows, lastInsertRowid: 0 };
    },
    prepare<T extends Record<string, unknown>>(
      query: Sql<T>
    ): PreparedStatement<T> {
      const statementSql = query.sql;
      return {
        query: async (params?: Value[]) => {
          const result = await runQuery(statementSql, params ?? []);
          return result.rows as T[];
        },
        run: async (params?: Value[]) => {
          const result = await runQuery(statementSql, params ?? []);
          return { changes: result.affectedRows, lastInsertRowid: 0 };
        },
      };
    },
    async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
      await call('begin');
      try {
        const result = await fn(sqlClient);
        await call('commit');
        return result;
      } catch (e) {
        await call('rollback');
        throw e;
      }
    },
  };

  const poolQuery = async (
    text: string,
    values?: unknown[]
  ): Promise<QueryResult> => {
    // Better Auth / Kysely already emit $n params for Postgres.
    const result = (await call('query', {
      sql: text,
      params: values ?? [],
    })) as { rows: QueryResult['rows']; affectedRows: number };
    return { rows: result.rows, rowCount: result.affectedRows };
  };

  const checkoutClient = (): PoolClient => ({
    query: ((text: string, values?: unknown[]) =>
      poolQuery(text, values)) as PoolClient['query'],
    release: () => undefined,
  });

  const poolAdapter = {
    connect: (
      callback?: (
        err: Error | undefined,
        client: PoolClient | undefined,
        done: (release?: boolean | (() => void)) => void
      ) => void
    ) => {
      if (typeof callback === 'function') {
        callback(undefined, checkoutClient(), () => undefined);
        return undefined;
      }
      return Promise.resolve(checkoutClient());
    },
    query: (
      text: string,
      values?: unknown[],
      callback?: (err: Error | undefined, result: unknown) => void
    ) => {
      const run = poolQuery(text, values);
      if (typeof callback === 'function') {
        void run
          .then((result) => callback(undefined, result))
          .catch((err: unknown) => {
            callback(
              err instanceof Error ? err : new Error(String(err)),
              undefined
            );
          });
        return undefined;
      }
      return run;
    },
    end: async () => {
      await sqlClient.disconnect();
    },
    on: () => poolAdapter,
    totalCount: 1,
    idleCount: 1,
    waitingCount: 0,
  };

  return {
    sqlClient,
    pool: poolAdapter as unknown as Pool,
    disconnect: () => sqlClient.disconnect(),
    exportBytes: async () => {
      const result = (await call('dump')) as { dumpB64: string };
      return new Uint8Array(Buffer.from(result.dumpB64, 'base64'));
    },
    replaceFromBytes: async (bytes) => {
      await call('replace', {
        dumpB64: Buffer.from(bytes).toString('base64'),
      });
    },
  };
}
