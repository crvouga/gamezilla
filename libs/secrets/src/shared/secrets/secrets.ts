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
  exportSecretsMapLive,
  fetchSecret,
  fetchSecretFrom,
  listSecretNames,
  listSecretNamesLive,
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
  exportSecretsMapLive,
  fetchSecret,
  fetchSecretFrom,
  getApiWorkerSecrets,
  getSecretMap,
  listSecretNames,
  listSecretNamesLive,
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
 * env in `envs` (default: all) that is still missing it. Does not overwrite
 * existing values.
 */
export async function ensureSeedInAllEnvsSecrets(
  envs: readonly SecretsEnv[] = SECRETS_ENVS
): Promise<readonly SeedInAllEnvsResult[]> {
  const active = activeSecretsEnv();
  const results: SeedInAllEnvsResult[] = [];

  for (const entry of getSeedInAllEnvsSecrets()) {
    if (entry.seed === undefined) continue;
    for (const env of envs) {
      const stored = new Map(await exportSecretsMapLive(env));
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

/**
 * Overwrite `process.env` with the secret store's live value of every
 * registry secret. `secrets-run` injects values once at process start;
 * provision steps later in the same deploy may rotate them (EMQX credentials,
 * Grafana tokens), so Worker deploys refresh before pushing bindings.
 */
export async function refreshSecretsIntoEnv(): Promise<void> {
  const live = await exportSecretsMapLive(activeSecretsEnv());
  for (const { name } of SECRETS) {
    const value = live.get(name)?.trim() ?? '';
    if (value.length > 0) process.env[name] = value;
  }
}
