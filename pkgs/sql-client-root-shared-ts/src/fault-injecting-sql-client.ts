import type { Sql } from '@pkgs/sql-root-shared-ts/sql';
import type { PreparedStatement, SqlClient } from './interface';

export type FaultInjectingSqlClient = {
  /** The client under test sees this. */
  readonly client: SqlClient & {
    resetDatabase: () => Promise<void>;
    onChanged: (listener: () => void) => () => void;
  };
  /** Every call fails from now on, as a dead database does. */
  readonly breakWith: (make: () => Error) => void;
  /** Only the next call fails; the database is otherwise healthy. */
  readonly failNextCallWith: (error: Error) => void;
  /** Every call from now on never settles. */
  readonly hang: () => void;
  readonly notifyChanged: () => void;
  readonly calls: () => number;
  readonly disconnects: () => number;
  readonly resets: () => number;
};

type Mode =
  | { readonly kind: 'healthy' }
  | { readonly kind: 'broken'; readonly make: () => Error }
  | { readonly kind: 'hung' };

/** `inner` behind a switch that makes every call fail as a dead database does. */
export function createFaultInjectingSqlClient(
  inner: SqlClient
): FaultInjectingSqlClient {
  let mode: Mode = { kind: 'healthy' };
  let failNext: Error | null = null;
  let calls = 0;
  let disconnects = 0;
  let resets = 0;
  const listeners = new Set<() => void>();

  const gate = <T>(run: () => Promise<T>): Promise<T> => {
    calls += 1;
    if (failNext !== null) {
      const error = failNext;
      failNext = null;
      return Promise.reject(error);
    }
    if (mode.kind === 'broken') return Promise.reject(mode.make());
    if (mode.kind === 'hung') return new Promise<T>(() => undefined);
    return run();
  };

  const wrapPrepared = <T extends Record<string, unknown>>(
    statement: PreparedStatement<T>
  ): PreparedStatement<T> => ({
    query: (params) => gate(() => statement.query(params)),
    run: (params) => gate(() => statement.run(params)),
  });

  const wrapTx = (tx: SqlClient): SqlClient => {
    const wrapped: SqlClient = {
      connect: () => tx.connect(),
      disconnect: () => tx.disconnect(),
      query: (query) => gate(() => tx.query(query)),
      run: (query) => gate(() => tx.run(query)),
      prepare: (query) => wrapPrepared(tx.prepare(query)),
      transaction: (body) => body(wrapped),
    };
    return wrapped;
  };

  const client: FaultInjectingSqlClient['client'] = {
    connect: () => gate(() => inner.connect()),
    disconnect: () => {
      disconnects += 1;
      return inner.disconnect();
    },
    query: <T extends Record<string, unknown>>(query: Sql<T>) =>
      gate(() => inner.query(query)),
    run: (query) => gate(() => inner.run(query)),
    prepare: (query) => wrapPrepared(inner.prepare(query)),
    transaction: (body) =>
      gate(() => inner.transaction((tx) => body(wrapTx(tx)))),
    resetDatabase: () => {
      resets += 1;
      return gate(() => Promise.resolve());
    },
    onChanged: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return {
    client,
    breakWith: (make) => {
      mode = { kind: 'broken', make };
    },
    failNextCallWith: (error) => {
      failNext = error;
    },
    hang: () => {
      mode = { kind: 'hung' };
    },
    notifyChanged: () => {
      for (const listener of listeners) listener();
    },
    calls: () => calls,
    disconnects: () => disconnects,
    resets: () => resets,
  };
}
