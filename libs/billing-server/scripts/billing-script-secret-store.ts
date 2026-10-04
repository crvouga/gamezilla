// @io-wall-ok
import { join } from 'node:path';
import type { HttpClient } from '@pkgs/http-client-shared/types';
import { createRepoTreeObjectStore } from '@pkgs/object-store-node-fs-server/repo-tree-store';
import { createWritableScriptSecretStore } from '@pkgs/secret-provider-server/create-configured-secret-store';
import { createCachingSecretStore } from '@pkgs/secret-store-shared/caching-secret-store';
import type { SecretStore } from '@pkgs/secret-store-shared/interface';

const REPO_ROOT = join(import.meta.dirname, '../../..');

export type CreateBillingScriptSecretStoreOptions = {
  readonly fetchFn: HttpClient['fetch'];
  readonly now: () => number;
};

/**
 * Secret-store-backed store for Node/Bun billing CLI scripts.
 */
export async function createBillingScriptSecretStore(
  options: CreateBillingScriptSecretStoreOptions
): Promise<SecretStore> {
  const store = await createWritableScriptSecretStore({
    repoRoot: REPO_ROOT,
    configStore: createRepoTreeObjectStore({ rootDir: REPO_ROOT }),
    fetchFn: options.fetchFn,
    clock: { now: options.now },
  });
  return createCachingSecretStore(store, {
    ttlMs: 60_000,
    now: options.now,
  });
}
