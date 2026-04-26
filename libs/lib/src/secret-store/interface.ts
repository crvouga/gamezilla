export type SecretStoreGetInit = {
  signal?: AbortSignal;
};

/**
 * Async key/value secrets. Implementations may call remote stores (e.g. Doppler).
 * Optional keys: absent or blank after trim → `null`. Transport / HTTP / parse errors throw.
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
}
