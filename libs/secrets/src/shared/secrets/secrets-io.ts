/**
 * Secret admin I/O — thin wrappers over {@link createSecretAdminStore}.
 * Kept separate from the registry so secret definitions can import fetch/set
 * helpers without a circular dependency on `registry.ts`.
 */

import { createRepoTreeObjectStore } from '@pkgs/object-store-node-fs/repo-tree-store';
import { createSecretAdminStore } from '@pkgs/secret-provider';
import { readSecretsCacheMap } from '@pkgs/secret-provider/local-secrets-cache';
import type { SecretAdminStore } from '@pkgs/secret-store';
import { REPO_ROOT } from '../paths';
import { activeEnvFile } from './secret';

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

async function readCachedSecretsMap(
  env: string
): Promise<ReadonlyMap<string, string> | null> {
  const store = createRepoTreeObjectStore({ rootDir: REPO_ROOT });
  return readSecretsCacheMap(store, env);
}

/** Always hit Infisical admin CLI (ignore local `.cache/secrets`). */
export async function exportSecretsMapLive(
  envOverride?: string
): Promise<ReadonlyMap<string, string>> {
  return (await getAdminStore()).exportSecrets(envOverride);
}

/**
 * Export secrets for an env. Prefers `.cache/secrets/<env>.json` when present
 * so `bun check` stays offline-first after `secrets:pull`.
 * Use {@link exportSecretsMapLive} for provision/seed writes.
 */
export async function exportSecretsMap(
  envOverride?: string
): Promise<ReadonlyMap<string, string>> {
  const env = envOverride ?? activeEnvFile().env;
  const cached = await readCachedSecretsMap(env);
  if (cached !== null) return cached;
  return exportSecretsMapLive(envOverride);
}

/** An environment's own secrets, live — none it reads through an import. */
export async function exportOwnSecretsLive(
  env: string
): Promise<ReadonlyMap<string, string>> {
  return (await getAdminStore()).exportOwnSecrets(env);
}

export async function listSecretNames(
  envOverride?: string
): Promise<ReadonlyArray<string>> {
  return [...(await exportSecretsMap(envOverride)).keys()];
}

/** Live Infisical names (ignore local cache) — for provision orphan purge. */
export async function listSecretNamesLive(
  envOverride?: string
): Promise<ReadonlyArray<string>> {
  return [...(await exportSecretsMapLive(envOverride)).keys()];
}
