import {
  getApiWorkerSecrets,
  getSecretMap,
  SECRETS,
} from './registry';
import {
  activeSecretsEnv,
  validateSecretOrError,
  type Secret,
  type SecretInput,
  type SecretsEnv,
} from './secret';
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
  validateSecretOrError,
};
export type { Secret, SecretInput, SecretsEnv };
export { activeSecretsEnv } from './secret';

/** @deprecated Use {@link validateSecretOrError} with a full SecretInput. */
export async function validateSecret(
  entry: Secret,
  value: string,
  env: SecretsEnv = activeSecretsEnv(),
  secrets: ReadonlyMap<string, string> = envMapFromProcess()
): Promise<string | null> {
  return validateSecretOrError(entry, {
    env,
    secretValue: value,
    secrets,
  });
}

function envMapFromProcess(): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of SECRETS) {
    const value = process.env[entry.name];
    if (typeof value === 'string' && value.length > 0) {
      map.set(entry.name, value);
    }
  }
  return map;
}

export function loadSecretsIntoEnv(): Array<{
  env: string;
  set: boolean;
  optional: boolean;
}> {
  const results: Array<{ env: string; set: boolean; optional: boolean }> = [];

  for (const entry of SECRETS) {
    const { name, optional } = entry;

    const existing = process.env[name];
    if (typeof existing === 'string' && existing.trim().length > 0) {
      results.push({ env: name, set: true, optional });
      continue;
    }

    try {
      const value = fetchSecret(name).trim();
      process.env[name] = value;
      results.push({ env: name, set: value.length > 0, optional });
    } catch {
      results.push({ env: name, set: false, optional });
    }
  }

  return results;
}

/**
 * @deprecated All secrets are in {@link SECRETS}; use {@link loadSecretsIntoEnv}.
 */
export function loadWorkerApiSecretsIntoEnv(): Array<{
  key: string;
  set: boolean;
}> {
  const results: Array<{ key: string; set: boolean }> = [];
  for (const entry of getApiWorkerSecrets()) {
    const existing = process.env[entry.name]?.trim();
    if (existing !== undefined && existing.length > 0) {
      results.push({ key: entry.name, set: true });
      continue;
    }
    try {
      const value = fetchSecret(entry.name).trim();
      process.env[entry.name] = value;
      results.push({ key: entry.name, set: value.length > 0 });
    } catch {
      results.push({ key: entry.name, set: false });
    }
  }
  return results;
}
