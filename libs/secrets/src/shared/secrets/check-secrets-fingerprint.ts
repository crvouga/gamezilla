import { createHash } from 'node:crypto';

import { SECRETS } from './registry';
import { SECRETS_ENVS } from './secret';
import { exportSecretsMap } from './secrets-io';

/** Env var Turbo hashes for `@libs/secrets#check` cache keys. */
export const CHECK_SECRETS_FINGERPRINT_ENV = 'CHECK_SECRETS_FINGERPRINT';

/**
 * Stable digest of registry secret values in `dev` + `prd`.
 * Orphans outside the registry are ignored (same as check:secrets).
 */
export async function computeCheckSecretsFingerprint(): Promise<string> {
  const hash = createHash('sha256');
  const names = SECRETS.map((s) => s.name).toSorted();
  for (const env of SECRETS_ENVS) {
    const secrets = await exportSecretsMap(env);
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
