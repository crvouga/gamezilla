// @io-wall-ok
import { join } from 'node:path';
import type { HttpClient } from '@pkgs/http-client';
import { createRepoTreeObjectStore } from '@pkgs/object-store/repo-tree-store';
import { createWritableScriptSecretStore } from '@pkgs/secret-provider';
import type { SecretStore } from '@pkgs/secret-store';
import { createCachingSecretStore } from '@pkgs/secret-store';

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
  });
  return createCachingSecretStore(store, {
    ttlMs: 60_000,
    now: options.now,
  });
}
