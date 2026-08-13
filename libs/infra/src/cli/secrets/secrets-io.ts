/**
 * Secret admin I/O — thin wrappers over {@link createSecretAdminStore}.
 * Kept separate from the registry so secret definitions can import fetch/set
 * helpers without a circular dependency on `registry.ts`.
 */
import { createSecretAdminStore } from '@pkgs/secret-provider';
import type { SecretAdminStore } from '@pkgs/secret-store';
import { createRepoTreeObjectStore } from '@pkgs/object-store/repo-tree-store';
import { REPO_ROOT } from '../paths';

let adminStorePromise: Promise<SecretAdminStore> | null = null;

function getAdminStore(): Promise<SecretAdminStore> {
  if (adminStorePromise === null) {
    adminStorePromise = createSecretAdminStore({
      repoRoot: REPO_ROOT,
      configStore: createRepoTreeObjectStore({ rootDir: REPO_ROOT }),
    });
  }
  return adminStorePromise;
}

/** Reset cached admin store (tests). */
export function _resetSecretAdminStoreForTesting(): void {
  adminStorePromise = null;
}

export async function fetchSecret(name: string): Promise<string> {
  return (await getAdminStore()).fetchSecret(name);
}

export async function secretExists(name: string): Promise<boolean> {
  return (await getAdminStore()).secretExists(name);
}

export async function setSecret(name: string, value: string): Promise<void> {
  await (await getAdminStore()).setSecret(name, value);
}

export async function deleteSecret(name: string): Promise<void> {
  await (await getAdminStore()).deleteSecret(name);
}

export async function deleteSecretIn(env: string, name: string): Promise<void> {
  await (await getAdminStore()).deleteSecret(name, env);
}

export async function fetchSecretFrom(
  env: string,
  name: string
): Promise<string> {
  return (await getAdminStore()).fetchSecret(name, env);
}

export async function setSecretIn(
  env: string,
  name: string,
  value: string
): Promise<void> {
  await (await getAdminStore()).setSecret(name, value, env);
}

export async function exportSecretsMap(
  envOverride?: string
): Promise<ReadonlyMap<string, string>> {
  return (await getAdminStore()).exportSecrets(envOverride);
}

export async function listSecretNames(
  envOverride?: string
): Promise<ReadonlyArray<string>> {
  return (await getAdminStore()).listSecretNames(envOverride);
}
