export type SecretStoreGetInit = {
  signal?: AbortSignal;
};

export type SecretStoreSetInit = {
  signal?: AbortSignal;
};

/**
 * Async key/value secrets — both read and write surfaces in one abstraction.
 * Implementations may call remote stores (e.g. Doppler) over HTTP, shell out
 * to a CLI, or compose other implementations.
 *
 * Read semantics:
 *   - Optional keys: absent or blank after trim → `null`. Transport / HTTP /
 *     parse errors throw.
 *
 * Write semantics:
 *   - {@link setSecret} MUST be idempotent: writing the same value twice MUST
 *     succeed; writing a different value MUST overwrite without error.
 *   - Implementations whose underlying transport cannot write (e.g. the
 *     Worker-side HTTP read endpoint) MUST throw a clearly-typed error from
 *     {@link setSecret} rather than silently no-op.
 */
export interface SecretStore {
  getRequired(name: string, init?: SecretStoreGetInit): Promise<string>;

  /** Missing or blank (after trim) → `null`. HTTP / parse failures still throw. */
  getOptional(name: string, init?: SecretStoreGetInit): Promise<string | null>;

  /**
   * One batch fetch when supported. Throws if any name is missing or blank.
   * Implementations should prefer a single network round-trip.
   */
  getRequiredMany(
    names: readonly string[],
    init?: SecretStoreGetInit
  ): Promise<Record<string, string>>;

  /**
   * Best-effort batch fetch: returns one entry per requested name. Missing or
   * blank values map to `null` (no throw). Transport / parse failures still
   * throw. Implementations should prefer a single network round-trip — this is
   * the primitive {@link CachingSecretStore} uses to coalesce concurrent
   * `getRequired` / `getOptional` cache misses into one upstream call so a
   * burst of inbound requests does not fan out into a burst of secret-store
   * requests (Doppler rate-limits at HTTP 429).
   */
  getOptionalMany(
    names: readonly string[],
    init?: SecretStoreGetInit
  ): Promise<Record<string, string | null>>;

  setSecret(
    name: string,
    value: string,
    init?: SecretStoreSetInit
  ): Promise<void>;
}
