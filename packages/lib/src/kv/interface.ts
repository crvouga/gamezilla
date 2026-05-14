import type { Keyword } from '../keyword/keyword';

/**
 * Minimal key-value store with atomic multi-operation composition.
 * Implementations may be backed by memory, Postgres, etc.
 *
 * Keys are {@link Keyword} only (Clojure-style `prefix/local`); raw strings are
 * not accepted at the type boundary.
 */
export interface Kv {
  /** Returns null if the key is absent. */
  get(key: Keyword): Promise<string | null>;

  /** Upsert. Replaces any existing value. */
  put(key: Keyword, value: string): Promise<void>;

  /**
   * Idempotent delete. Does not error if the key is absent.
   */
  zap(key: Keyword): Promise<void>;

  /**
   * Runs `fn` with a nested {@link Kv} scoped to a database transaction when
   * the backing `SqlClient` uses native Postgres over TCP (e.g. Bun `SQL`).
   * HTTP-only `SqlClient` implementations may not provide real `BEGIN`/`COMMIT`
   * across statements — check the adapter.
   */
  transaction<T>(fn: (tx: Kv) => Promise<T>): Promise<T>;
}
