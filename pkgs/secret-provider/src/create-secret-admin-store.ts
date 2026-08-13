import type { ObjectStore } from '@pkgs/object-store/interface';
import type { SecretAdminStore } from '@pkgs/secret-store';
import { createInfisicalCliAdminStore } from './impl-infisical/cli-admin-store';

export type CreateSecretAdminStoreOptions = {
  readonly repoRoot: string;
  readonly configStore: ObjectStore;
};

/**
 * Administrative secret store for provision (seed / mirror / purge / export).
 */
export async function createSecretAdminStore(
  options: CreateSecretAdminStoreOptions
): Promise<SecretAdminStore> {
  return createInfisicalCliAdminStore(options);
}
