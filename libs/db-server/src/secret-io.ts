import { join } from 'node:path';
import { createRepoTreeObjectStore } from '@pkgs/object-store-node-fs-server/repo-tree-store';
import { createSecretAdminStore } from '@pkgs/secret-provider-server/create-secret-admin-store';
import type { SecretAdminStore } from '@pkgs/secret-store-shared/admin-interface';
import { cliClock } from '@libs/db-shared/cli-io';

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..');

let adminStorePromise: Promise<SecretAdminStore> | null = null;

function getAdminStore(): Promise<SecretAdminStore> {
  if (adminStorePromise === null) {
    adminStorePromise = createSecretAdminStore({
      repoRoot: REPO_ROOT,
      configStore: createRepoTreeObjectStore({ rootDir: REPO_ROOT }),
      clock: cliClock,
    });
  }
  return adminStorePromise;
}

export async function fetchSecret(name: string): Promise<string> {
  return (await getAdminStore()).fetchSecret(name);
}

export async function fetchSecretFrom(
  env: string,
  name: string
): Promise<string> {
  return (await getAdminStore()).fetchSecret(name, env);
}
