/**
 * Administrative secret operations (list / export / delete / cross-env write)
 * used by tooling and provision — not the Worker runtime hot path.
 *
 * Implementations may shell out to a provider CLI or call a management API.
 * Callers must not assume a specific backend.
 */
export interface SecretAdminStore {
  fetchSecret(name: string, envOverride?: string): Promise<string>;

  secretExists(name: string, envOverride?: string): Promise<boolean>;

  setSecret(name: string, value: string, envOverride?: string): Promise<void>;

  deleteSecret(name: string, envOverride?: string): Promise<void>;

  exportSecrets(envOverride?: string): Promise<ReadonlyMap<string, string>>;

  listSecretNames(envOverride?: string): Promise<readonly string[]>;
}
