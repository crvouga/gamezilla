import { getApiWorkerSecrets, getSecretMap, SECRETS } from './registry';
import { activeEnvFile } from './secret';
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

export type { Secret, SecretInput } from './secret';
export { activeEnvFile, validateSecretOrError } from './secret';
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
  const live = await exportSecretsMapLive(activeEnvFile().env);
  for (const { name } of SECRETS) {
    const value = live.get(name)?.trim() ?? '';
    if (value.length > 0) process.env[name] = value;
  }
}
