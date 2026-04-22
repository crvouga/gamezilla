/**
 * Minimal key-value store with atomic multi-operation composition.
 * Implementations may be backed by memory, Postgres, etc.
 */
export interface Kv {
  /** Returns null if the key is absent. */
  get(key: string): Promise<string | null>;

  /** Upsert. Replaces any existing value. */
  put(key: string, value: string): Promise<void>;

  /**
   * Idempotent delete. Does not error if the key is absent.
   */
  zap(key: string): Promise<void>;

  /**
   * Runs `fn` with a nested {@link Kv} scoped to a database transaction when
   * the backing `SqlClient` uses native Postgres over TCP (e.g. Bun `SQL`).
   * HTTP-only `SqlClient` implementations may not provide real `BEGIN`/`COMMIT`
   * across statements — check the adapter.
   */
  transaction<T>(fn: (tx: Kv) => Promise<T>): Promise<T>;
}
