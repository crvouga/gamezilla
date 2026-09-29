import type { Clock } from '@pkgs/clock';
import type { ObjectStore } from '@pkgs/object-store/interface';
import type { SecretAdminStore } from '@pkgs/secret-store';
import { createInfisicalCliAdminStore } from './impl-infisical/cli-admin-store';

export type CreateSecretAdminStoreOptions = {
  readonly repoRoot: string;
  readonly configStore: ObjectStore;
  /** Tells when a minted CI token is due for replacement. */
  readonly clock: Clock;
};

/**
 * Administrative secret store for provision (seed / mirror / purge / export).
 */
export async function createSecretAdminStore(
  options: CreateSecretAdminStoreOptions
): Promise<SecretAdminStore> {
  return createInfisicalCliAdminStore(options);
}
