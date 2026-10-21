import type { AttributeState } from '@pkgs/attribute-shared-ts/attribute';
import type { Keyword } from '@pkgs/keyword-shared-ts/keyword';

/**
 * One KV row value: flat map keyed by namespaced keywords (same shape as
 * {@link AttributeState} / room state / sync entity attributes).
 */
export type KvRecord = AttributeState;

/**
 * Minimal key-value store with atomic multi-operation composition.
 * Implementations may be backed by memory, Postgres, etc.
 *
 * Row keys are {@link Keyword} only. Row values are always {@link KvRecord} —
 * never raw strings or arbitrary JSON roots. Consumers should compose values
 * with {@link @pkgs/attribute-shared-ts} `createAttrNamespace` tags.
 */
export interface Kv {
  /** Returns null if the key is absent. */
  get(key: Keyword): Promise<KvRecord | null>;

  /** Upsert. Replaces any existing value. */
  put(key: Keyword, value: KvRecord): Promise<void>;

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
  tx<T>(fn: (tx: Kv) => Promise<T>): Promise<T>;
}
