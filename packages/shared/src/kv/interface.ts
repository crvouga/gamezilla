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
   * Runs `fn` atomically. Implementations must provide isolation equivalent to
   * serializable transactions: concurrent `transaction` calls must not observe
   * partial updates from each other, and conflicting read/write pairs must be
   * serialized (one succeeds, others retry or block).
   */
  transaction<T>(fn: (tx: Kv) => Promise<T>): Promise<T>;
}
