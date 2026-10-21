import type { Clock } from '@pkgs/clock-shared-ts/types';
import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';
import type { SecretAdminStore } from '@pkgs/secret-store-shared-ts/admin-interface';
import { createInfisicalCliAdminStore } from './cli-admin-store';

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
