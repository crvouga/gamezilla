import { createHash } from 'node:crypto';

import { createRepoTreeObjectStore } from '@pkgs/object-store-node-fs/repo-tree-store';
import { readSecretsCacheFingerprint } from '@pkgs/secret-provider/local-secrets-cache';
import { REPO_ROOT } from '../paths';
import { SECRETS } from './registry';
import { SECRETS_ENVS, type SecretsEnv } from './secret';
import { exportSecretsMap } from './secrets-io';

/** Env var Turbo hashes for `@libs/secrets#check` cache keys. */
export const CHECK_SECRETS_FINGERPRINT_ENV = 'CHECK_SECRETS_FINGERPRINT';

/**
 * Stable digest of registry secret values from provided `dev` + `prd` maps.
 * Orphans outside the registry are ignored (same as check:secrets).
 */
export function computeCheckSecretsFingerprintFromMaps(
  maps: Readonly<Record<SecretsEnv, ReadonlyMap<string, string>>>
): string {
  const hash = createHash('sha256');
  const names = SECRETS.map((s) => s.name).toSorted();
  for (const env of SECRETS_ENVS) {
    const secrets = maps[env];
    for (const name of names) {
      hash.update(env);
      hash.update('\0');
      hash.update(name);
      hash.update('\0');
      hash.update(secrets.get(name) ?? '');
      hash.update('\0');
    }
  }
  return hash.digest('hex');
}

/**
 * Prefer `.cache/secrets/fingerprint` from `secrets:pull`, else digest
 * registry values via {@link exportSecretsMap} (local cache or Infisical).
 */
export async function computeCheckSecretsFingerprint(): Promise<string> {
  const store = createRepoTreeObjectStore({ rootDir: REPO_ROOT });
  const cached = await readSecretsCacheFingerprint(store);
  if (cached !== null) return cached;

  const maps = {
    dev: await exportSecretsMap('dev'),
    prd: await exportSecretsMap('prd'),
  } as const;
  return computeCheckSecretsFingerprintFromMaps(maps);
}
