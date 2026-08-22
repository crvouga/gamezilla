import {
  getApiWorkerSecrets,
  getSecretMap,
  getSeedInAllEnvsSecrets,
  SECRETS,
} from './registry';
import { activeSecretsEnv, SECRETS_ENVS, type SecretsEnv } from './secret';
import {
  deleteSecret,
  deleteSecretIn,
  exportSecretsMap,
  fetchSecret,
  fetchSecretFrom,
  listSecretNames,
  secretExists,
  setSecret,
  setSecretIn,
} from './secrets-io';

export type { Secret, SecretInput, SecretsEnv } from './secret';
export { activeSecretsEnv, validateSecretOrError } from './secret';
export {
  deleteSecret,
  deleteSecretIn,
  exportSecretsMap,
  fetchSecret,
  fetchSecretFrom,
  getApiWorkerSecrets,
  getSecretMap,
  listSecretNames,
  SECRETS,
  secretExists,
  setSecret,
  setSecretIn,
};

export type SeedInAllEnvsResult = {
  readonly name: string;
  readonly env: SecretsEnv;
  readonly action: 'seeded' | 'present';
};

/**
 * For registry secrets with `seedInAllEnvs`, mint a value into every secrets
 * env that is still missing it. Does not overwrite existing values.
 */
export async function ensureSeedInAllEnvsSecrets(): Promise<
  readonly SeedInAllEnvsResult[]
> {
  const active = activeSecretsEnv();
  const results: SeedInAllEnvsResult[] = [];

  for (const entry of getSeedInAllEnvsSecrets()) {
    if (entry.seed === undefined) continue;
    for (const env of SECRETS_ENVS) {
      const stored = new Map(await exportSecretsMap(env));
      const current = (stored.get(entry.name) ?? '').trim();
      if (current.length > 0) {
        results.push({ name: entry.name, env, action: 'present' });
        if (env === active && !process.env[entry.name]?.trim()) {
          process.env[entry.name] = current;
        }
        continue;
      }
      const value = (await entry.seed({ env, secrets: stored })).trim();
      if (value.length === 0) continue;
      await setSecretIn(env, entry.name, value);
      stored.set(entry.name, value);
      if (env === active) {
        process.env[entry.name] = value;
      }
      results.push({ name: entry.name, env, action: 'seeded' });
    }
  }

  return results;
}

export async function loadSecretsIntoEnv(): Promise<
  Array<{
    env: string;
    set: boolean;
    optional: boolean;
  }>
> {
  const results: Array<{ env: string; set: boolean; optional: boolean }> = [];

  for (const entry of SECRETS) {
    const { name, optional } = entry;

    const existing = process.env[name];
    if (typeof existing === 'string' && existing.trim().length > 0) {
      results.push({ env: name, set: true, optional });
      continue;
    }

    try {
      const value = (await fetchSecret(name)).trim();
      process.env[name] = value;
      results.push({ env: name, set: value.length > 0, optional });
    } catch {
      results.push({ env: name, set: false, optional });
    }
  }

  return results;
}
