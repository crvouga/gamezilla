/**
 * PGlite → {@link SqlClient} adapter for hermetic Postgres-compatible sims.
 *
 * Duck-typed over anything with `.query` + `.transaction` (typically
 * `@electric-sql/pglite`). Lifecycle helpers {@link openPgliteSqlClient} own
 * `create` / `close` and expose dump/restore via `dumpDataDir` / `loadDataDir`.
 *
 * Uses `query.sql` (`?`) → `$n` like every other Postgres impl in this
 * package. Nested `transaction()` on a tx handle is rejected — PGlite has
 * no savepoint nesting through this surface.
 */
// @io-wall-ok — browser PGlite WASM boot uses wall fetch for `/generated/pglite`

import { PGlite } from '@electric-sql/pglite';
import type { Sql, Value } from '@pkgs/sql';
import type { PreparedStatement, RunResult, SqlClient } from '../interface';
import { questionMarkParamsToDollarParams } from '../positional-params';
import { normalizePgInt8Rows } from './normalize-pg-int8';
import type { Pool, PoolClient, QueryResult } from './pg-types';

type PgliteQueryResult<T> = {
  readonly rows: readonly T[];
  readonly affectedRows?: number;
};

type PgliteQueryable = {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[]
  ): Promise<PgliteQueryResult<T>>;
};

type PgliteLike = PgliteQueryable & {
  transaction<T>(fn: (tx: PgliteQueryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  dumpDataDir(compression?: 'auto' | 'gzip' | 'none'): Promise<File | Blob>;
};

function runResultFrom(result: PgliteQueryResult<unknown>): RunResult {
  return { changes: result.affectedRows ?? 0, lastInsertRowid: 0 };
}

async function execQuery<T>(
  queryable: PgliteQueryable,
  sqlText: string,
  params?: readonly unknown[]
): Promise<PgliteQueryResult<T>> {
  const [text, vals] = questionMarkParamsToDollarParams(sqlText, params);
  const coerced = vals?.map((v) => (v === '' ? null : v));
  return queryable.query<T>(text, coerced);
}

function prepareFor<T extends Record<string, unknown>>(
  queryable: PgliteQueryable,
  query: Sql<T>
): PreparedStatement<T> {
  const statementSql = query.sql;
  return {
    query: async (params?: Value[]) => {
      const result = await execQuery<T>(queryable, statementSql, params ?? []);
      return normalizePgInt8Rows([...result.rows]);
    },
    run: async (params?: Value[]) => {
      const result = await execQuery(queryable, statementSql, params ?? []);
      return runResultFrom(result);
    },
  };
}

function wrap(queryable: PgliteQueryable): SqlClient {
  return {
    connect: async () => {
      /* PGlite lifecycle is owned by the caller */
    },
    disconnect: async () => {
      /* PGlite lifecycle is owned by the caller */
    },
    async query<T extends Record<string, unknown>>(
      query: Sql<T>
    ): Promise<T[]> {
      const result = await execQuery<T>(queryable, query.sql, query.values);
      return normalizePgInt8Rows([...result.rows]);
    },
    async run(query: Sql<unknown>): Promise<RunResult> {
      const result = await execQuery(queryable, query.sql, query.values);
      return runResultFrom(result);
    },
    prepare<T extends Record<string, unknown>>(
      query: Sql<T>
    ): PreparedStatement<T> {
      return prepareFor(queryable, query);
    },
    transaction<T>(_fn: (tx: SqlClient) => Promise<T>): Promise<T> {
      throw new Error(
        'Nested transactions are not supported by the PGlite SqlClient'
      );
    },
  };
}

/** Adapts a PGlite (or compatible) instance to {@link SqlClient}. */
export function createPgliteSqlClient(db: PgliteLike): SqlClient {
  return {
    ...wrap(db),
    transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
      return db.transaction((tx) => fn(wrap(tx)));
    },
  };
}

/**
 * Minimal `pg.Pool` facade over a single PGlite instance.
 * Enough for Better Auth Kysely migrate (`pool.query` / `pool.connect`).
 */
export function adaptPgliteAsPool(db: PgliteQueryable): Pool {
  const runQuery = async (
    text: string,
    values?: unknown[]
  ): Promise<QueryResult> => {
    const result = await db.query(text, values ?? []);
    return {
      rows: normalizePgInt8Rows(
        result.rows as Record<string, unknown>[]
      ) as QueryResult['rows'],
      rowCount: result.affectedRows ?? result.rows.length,
    };
  };

  const checkoutClient = (): PoolClient => {
    return {
      query: ((text: string, values?: unknown[]) =>
        runQuery(text, values)) as PoolClient['query'],
      release: () => undefined,
    };
  };

  let ended = false;
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
      const run = runQuery(text, values);
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
      ended = true;
    },
    on: () => poolAdapter,
    totalCount: 1,
    idleCount: ended ? 0 : 1,
    waitingCount: 0,
  };
  return poolAdapter as unknown as Pool;
}

async function blobToBytes(blob: Blob | File): Promise<Uint8Array> {
  const buf = await blob.arrayBuffer();
  return new Uint8Array(buf);
}

function bytesAsBlob(bytes: Uint8Array): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer]);
}

function isBrowserPlayground(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    (typeof process === 'undefined' ||
      process.env['JEST_WORKER_ID'] === undefined)
  );
}

/**
 * Expo web: fetch WASM + fs bundle from `/generated/pglite` (copied by
 * `product/console/scripts/bundle-sim-sql-wasm.ts`) so the CJS build does not
 * resolve assets via `new URL(..., document.currentScript)`.
 */
async function createBrowserPglite(seedBytes?: Uint8Array): Promise<PGlite> {
  const base = new URL('/generated/pglite/', window.location.href);
  const [pgliteWasmModule, initdbWasmModule, fsBundle] = await Promise.all([
    WebAssembly.compileStreaming(fetch(new URL('pglite.wasm', base))),
    WebAssembly.compileStreaming(fetch(new URL('initdb.wasm', base))),
    fetch(new URL('pglite.data', base)).then((response) => {
      if (!response.ok) {
        throw new Error(
          `Failed to fetch PGlite fs bundle: ${response.statusText}`
        );
      }
      return response.blob();
    }),
  ]);
  return PGlite.create({
    pgliteWasmModule,
    initdbWasmModule,
    fsBundle,
    ...(seedBytes !== undefined ? { loadDataDir: bytesAsBlob(seedBytes) } : {}),
  }) as Promise<PGlite>;
}

async function createPgliteInstance(seedBytes?: Uint8Array): Promise<PGlite> {
  if (isBrowserPlayground()) {
    return createBrowserPglite(seedBytes);
  }
  if (seedBytes !== undefined) {
    return PGlite.create({ loadDataDir: bytesAsBlob(seedBytes) });
  }
  return PGlite.create();
}

export type OpenPgliteSqlClientArgs = {
  /** Gzip (or none) dump from a prior {@link PgliteSqlBundle.exportBytes}. */
  readonly seedBytes?: Uint8Array;
};

export type PgliteSqlBundle = {
  readonly sqlClient: SqlClient;
  readonly pool: Pool;
  /** In-process PGlite only; worker path throws if read. */
  readonly raw?: PGlite;
  disconnect(): Promise<void>;
  exportBytes(): Promise<Uint8Array>;
  /** Replace live DB contents by closing and reloading from dump bytes. */
  replaceFromBytes(bytes: Uint8Array): Promise<void>;
};

/**
 * Own a PGlite instance + SqlClient + Pool. Prefer gzip dumps for seed size.
 *
 * On Node, hosts PGlite in a worker thread (`--experimental-vm-modules`) so
 * Jest/jest-expo can open without poisoning the main VM. In the browser,
 * creates in-process.
 */
export async function openPgliteSqlClient(
  args?: OpenPgliteSqlClientArgs
): Promise<PgliteSqlBundle> {
  // Real browsers need in-process WASM. Jest/jsdom also define `window`, so
  // use a worker whenever Jest is hosting (or when there is no DOM).
  const useWorker =
    (typeof process !== 'undefined' &&
      process.env['JEST_WORKER_ID'] !== undefined) ||
    (typeof window === 'undefined' &&
      typeof process !== 'undefined' &&
      typeof process.versions === 'object' &&
      process.versions !== null &&
      typeof process.versions.node === 'string');
  if (useWorker) {
    const { openPgliteWorkerSqlClient } = await import(
      './pglite-worker-client'
    );
    const live = await openPgliteWorkerSqlClient(args);
    return {
      get sqlClient() {
        return live.sqlClient;
      },
      get pool() {
        return live.pool;
      },
      get raw(): PGlite {
        throw new Error(
          'PGlite raw handle is not available on the worker path'
        );
      },
      disconnect: () => live.disconnect(),
      exportBytes: () => live.exportBytes(),
      replaceFromBytes: (bytes) => live.replaceFromBytes(bytes),
    };
  }

  let db: PGlite = await createPgliteInstance(args?.seedBytes);

  const bind = (live: PGlite): Omit<PgliteSqlBundle, 'replaceFromBytes'> => {
    const sqlClient = createPgliteSqlClient(live);
    const pool = adaptPgliteAsPool(live);
    return {
      sqlClient,
      pool,
      raw: live,
      disconnect: () => live.close(),
      exportBytes: async () => blobToBytes(await live.dumpDataDir('gzip')),
    };
  };

  let current = bind(db);

  return {
    get sqlClient() {
      return current.sqlClient;
    },
    get pool() {
      return current.pool;
    },
    get raw() {
      return current.raw as PGlite;
    },
    disconnect: () => current.disconnect(),
    exportBytes: () => current.exportBytes(),
    replaceFromBytes: async (bytes) => {
      await current.disconnect();
      db = await createPgliteInstance(bytes);
      current = bind(db);
    },
  };
}
