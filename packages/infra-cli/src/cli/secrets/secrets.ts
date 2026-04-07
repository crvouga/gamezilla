import { runCapture } from '../subprocess';
import { CfAccountId } from './cf-account-id';
import { CfApiToken } from './cf-api-token';
import { PsServiceToken, PsServiceTokenId } from './ps-credentials';
import { PsDatabase } from './ps-database';
import { PsOrg } from './ps-org';
import { TfToken } from './tf-token';
import type { SecretEntry } from './types';

export { validateSecret } from './types';
export type { SecretEntry } from './types';

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
