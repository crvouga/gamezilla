/**
 * Isomorphic Postgres pool / client shapes used across Worker, harnesses, and
 * web (mockingbird-postgres). Hand-written so the bundler never resolves `node-postgres`
 * (`pg`) via type re-exports — that package is Node-only and crashes in the
 * browser (`util.deprecate`).
 *
 * Real TCP connections still go through wall openers
 * (`postgres/connect.ts`, `postgres/ping.ts`) which value-import `pg` and
 * return handles structurally compatible with these types.
 */

export type QueryResultRow = Record<string, unknown>;

export type QueryResult<R extends QueryResultRow = QueryResultRow> = {
  rows: R[];
  fields?: readonly { name: string; dataTypeID: number }[];
  rowCount: number | null;
};

/**
 * `pg.Client#query` / `Pool#query` / `PoolClient#query` overload surface.
 * Kept loose so wall `pg` instances and mockingbird-postgres pools both assign.
 */
// biome-ignore lint/suspicious/noExplicitAny: mirrors node-postgres query overloads
export type PgQueryFn = (...args: any[]) => any;

/** Checked-out pool client (or pinned single session presented as one). */
export type PoolClient = {
  query: PgQueryFn;
  release: (err?: Error | boolean) => void;
};

/** Single TCP session (`pg.Client`) or compatible. */
export type Client = {
  query: PgQueryFn;
  connect: () => Promise<void>;
  end: () => Promise<void>;
};

/** Pool or pool-shaped adapter (real `pg.Pool`, MemPool, adaptPgClientAsPool). */
export type Pool = {
  query: PgQueryFn;
  connect: {
    (): Promise<PoolClient>;
    (
      callback: (
        err: Error | undefined,
        client: PoolClient | undefined,
        done: (release?: boolean | (() => void)) => void
      ) => void
    ): void;
  };
  end: () => Promise<void>;
  /** Used by {@link isPgPool} in impl-pg-shared (real pools expose this). */
  totalCount?: number;
};

/** Alias kept for call sites that mirrored `pg.ClientBase`. */
export type ClientBase = Client;
