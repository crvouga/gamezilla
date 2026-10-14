/**
 * A {@link SqlClient} for a database that is only a cache. When the storage
 * under it fails (a corrupt file, a full disk, a dead worker, a lost owner
 * tab, a hung open) the client replaces it with a fresh disposable database
 * and carries on, so the cache can slow the app down but never stop it.
 *
 * What does not fail over: an error the database answered with (a
 * constraint, a syntax error) and an error the caller's own transaction body
 * threw. Those reach the caller, as they do on a healthy database.
 *
 * A call that met the failure runs again on the replacement. A transaction
 * body therefore runs again, so it must touch only the database it is given.
 */

import type { Sql } from '@pkgs/sql-root-shared/sql';
import sql from '@pkgs/sql-root-shared/sql';
import type { PreparedStatement, RunResult, SqlClient } from './interface';
import { classifyLocalStorageFailure } from './local-storage-failure';

export type FailoverTimers = {
  readonly setTimeout: (fn: () => void, ms: number) => unknown;
  readonly clearTimeout: (handle: unknown) => void;
};

/** What a browser database client adds on top of {@link SqlClient}. */
export type ResettableSqlClient = SqlClient & {
  readonly resetDatabase?: () => Promise<void>;
  readonly onChanged?: (listener: () => void) => () => void;
};

export type FailoverSqlClientOptions = {
  readonly primary: ResettableSqlClient;
  /**
   * Opens the replacement, connected. `reason` is the failure that made it
   * needed (`undefined` when a reset empties a replacement already in use).
   * Its own failure is the last resort.
   */
  readonly openFallback: (reason: unknown) => Promise<SqlClient>;
  /** Readies the replacement (schema) before any call reaches it. */
  readonly prepareFallback?: (fallback: SqlClient) => Promise<void>;
  /** Told once, after the replacement is in place; never awaited. */
  readonly onFailover?: (reason: unknown) => void;
  /** A call to the primary that outlasts this is a failure. */
  readonly deadline?: { readonly timers: FailoverTimers; readonly ms: number };
};

export type FailoverSqlClient = ResettableSqlClient & {
  readonly failedOver: () => boolean;
};

type Backend = { readonly client: SqlClient; readonly fallback: boolean };

function timeoutError(ms: number): Error {
  const error = new Error(`local database did not respond within ${ms}ms`);
  error.name = 'RpcTimeoutError';
  return error;
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

/** Marks which side of a transaction an error came from. */
type ErrorOrigins = {
  readonly fromClient: WeakSet<object>;
  readonly fromCaller: WeakSet<object>;
};

async function tagClientError<T>(
  origins: ErrorOrigins,
  work: Promise<T>
): Promise<T> {
  try {
    return await work;
  } catch (error) {
    if (isObject(error)) origins.fromClient.add(error);
    throw error;
  }
}

function trackedTransaction(origins: ErrorOrigins, tx: SqlClient): SqlClient {
  const tracked: SqlClient = {
    connect: () => tx.connect(),
    disconnect: () => tx.disconnect(),
    query: (query) => tagClientError(origins, tx.query(query)),
    run: (query) => tagClientError(origins, tx.run(query)),
    prepare: (query) => tx.prepare(query),
    transaction: (inner) => inner(tracked),
  };
  return tracked;
}

async function runCallerBody<T>(
  origins: ErrorOrigins,
  tx: SqlClient,
  body: (tx: SqlClient) => Promise<T>
): Promise<T> {
  try {
    return await body(trackedTransaction(origins, tx));
  } catch (error) {
    if (isObject(error) && !origins.fromClient.has(error)) {
      origins.fromCaller.add(error);
    }
    throw error;
  }
}

class Failover {
  private current: Backend;
  private switching: Promise<Backend> | null = null;
  private readonly origins: ErrorOrigins = {
    fromClient: new WeakSet(),
    fromCaller: new WeakSet(),
  };

  constructor(private readonly options: FailoverSqlClientOptions) {
    this.current = { client: options.primary, fallback: false };
  }

  failedOver = (): boolean => this.current.fallback;

  private within<T>(work: Promise<T>): Promise<T> {
    const { deadline } = this.options;
    if (deadline === undefined) return work;
    const { timers, ms } = deadline;
    return new Promise<T>((resolve, reject) => {
      const handle = timers.setTimeout(() => reject(timeoutError(ms)), ms);
      work.then(
        (value) => {
          timers.clearTimeout(handle);
          resolve(value);
        },
        (error: unknown) => {
          timers.clearTimeout(handle);
          reject(error);
        }
      );
    });
  }

  private async openReadyFallback(reason: unknown): Promise<SqlClient> {
    const client = await this.options.openFallback(reason);
    try {
      await this.options.prepareFallback?.(client);
    } catch (error) {
      await client.disconnect().catch(() => undefined);
      throw error;
    }
    return client;
  }

  private install(client: SqlClient, replaced: Backend): Backend {
    this.current = { client, fallback: true };
    // The replaced database may be hung; releasing it must never block.
    void replaced.client.disconnect().catch(() => undefined);
    return this.current;
  }

  private failOver(from: Backend, reason: unknown): Promise<Backend> {
    if (this.current !== from) return Promise.resolve(this.current);
    this.switching ??= this.openReadyFallback(reason)
      .then((client) => {
        const backend = this.install(client, from);
        try {
          this.options.onFailover?.(reason);
        } catch {
          // Reporting the failover must not undo it.
        }
        return backend;
      })
      .finally(() => {
        this.switching = null;
      });
    return this.switching;
  }

  private async storageLost(
    backend: Backend,
    error: unknown
  ): Promise<boolean> {
    const kind = classifyLocalStorageFailure(error);
    if (kind !== 'unknown') return kind === 'storage';
    try {
      await this.within(
        backend.client.query(sql<{ ok: number }>`SELECT 1 AS ok`)
      );
      return false;
    } catch {
      return true;
    }
  }

  guarded = async <T>(work: (client: SqlClient) => Promise<T>): Promise<T> => {
    const backend = this.current;
    if (backend.fallback) return work(backend.client);
    try {
      return await this.within(work(backend.client));
    } catch (error) {
      if (isObject(error) && this.origins.fromCaller.has(error)) throw error;
      if (!(await this.storageLost(backend, error))) throw error;
      const next = await this.failOver(backend, error);
      return work(next.client);
    }
  };

  connect = async (): Promise<void> => {
    const backend = this.current;
    try {
      await this.within(backend.client.connect());
    } catch (error) {
      if (backend.fallback) throw error;
      await this.failOver(backend, error);
    }
  };

  disconnect = (): Promise<void> =>
    this.current.client.disconnect().catch(() => undefined);

  transaction = <T>(body: (tx: SqlClient) => Promise<T>): Promise<T> =>
    this.guarded((client) =>
      client.transaction((tx) => runCallerBody(this.origins, tx, body))
    );

  prepare = <T extends Record<string, unknown>>(
    query: Sql<T>
  ): PreparedStatement<T> => {
    let bound: { client: SqlClient; statement: PreparedStatement<T> } | null =
      null;
    const statementFor = (client: SqlClient): PreparedStatement<T> => {
      if (bound?.client !== client) {
        bound = { client, statement: client.prepare(query) };
      }
      return bound.statement;
    };
    return {
      query: (params) =>
        this.guarded((client) => statementFor(client).query(params)),
      run: (params) =>
        this.guarded((client) => statementFor(client).run(params)),
    };
  };

  resetDatabase = async (): Promise<void> => {
    const backend = this.current;
    try {
      if (backend.fallback) {
        this.install(await this.openReadyFallback(undefined), backend);
        return;
      }
      await this.within(
        this.options.primary.resetDatabase?.() ?? Promise.resolve()
      );
    } catch (error) {
      if (backend.fallback) throw error;
      await this.failOver(backend, error);
    }
  };

  onChanged = (listener: () => void): (() => void) => {
    const unsubscribe = this.options.primary.onChanged?.(() => {
      if (!this.current.fallback) listener();
    });
    return () => unsubscribe?.();
  };
}

export function createFailoverSqlClient(
  options: FailoverSqlClientOptions
): FailoverSqlClient {
  const core = new Failover(options);
  const { primary } = options;
  return {
    failedOver: core.failedOver,
    connect: core.connect,
    disconnect: core.disconnect,
    query: <T extends Record<string, unknown>>(query: Sql<T>) =>
      core.guarded((client) => client.query(query)),
    run: (query: Sql<unknown>): Promise<RunResult> =>
      core.guarded((client) => client.run(query)),
    transaction: core.transaction,
    prepare: core.prepare,
    ...(primary.resetDatabase !== undefined
      ? { resetDatabase: core.resetDatabase }
      : {}),
    ...(primary.onChanged !== undefined ? { onChanged: core.onChanged } : {}),
  };
}
