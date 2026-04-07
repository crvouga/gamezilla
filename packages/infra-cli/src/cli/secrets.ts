import { runCapture } from './subprocess';
import type { SecretEntry } from './secrets/types';
import { TfToken } from './secrets/tf-token';
import { CfApiToken } from './secrets/cf-api-token';
import { CfAccountId } from './secrets/cf-account-id';
import { PsServiceTokenId, PsServiceToken } from './secrets/ps-credentials';
import { PsOrg } from './secrets/ps-org';
import { PsDatabase } from './secrets/ps-database';

export type { SecretEntry } from './secrets/types';
export { validateSecret } from './secrets/types';

const SECRET_MAP: ReadonlyArray<SecretEntry> = [
  new TfToken(),
  new CfApiToken(),
  new CfAccountId(),
  new PsServiceTokenId(),
  new PsServiceToken(),
  new PsOrg(),
  new PsDatabase(),
];

export function getSecretMap(): ReadonlyArray<SecretEntry> {
  return SECRET_MAP;
}

export function fetchDopplerSecret(name: string): string {
  return runCapture('doppler', ['secrets', 'get', name, '--plain']);
}

export function dopplerSecretExists(name: string): boolean {
  try {
    const value = fetchDopplerSecret(name);
    return value !== '';
  } catch {
    return false;
  }
}

export function setDopplerSecret(name: string, value: string): void {
  runCapture('doppler', ['secrets', 'set', `${name}=${value}`]);
}

export function loadSecretsIntoEnv(): Array<{ env: string; set: boolean }> {
  const results: Array<{ env: string; set: boolean }> = [];

  for (const { doppler, env } of SECRET_MAP) {
    try {
      const value = fetchDopplerSecret(doppler);
      process.env[env] = value;
      results.push({ env, set: true });
    } catch {
      results.push({ env, set: false });
    }
  }

  return results;
}
