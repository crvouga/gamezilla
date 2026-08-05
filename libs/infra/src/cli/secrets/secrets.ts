import { getApiWorkerSecrets, getSecretMap, SECRETS } from './registry';
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
export type { Secret, SecretInput, SecretsEnv } from './secret';
export { activeSecretsEnv, validateSecretOrError } from './secret';

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
