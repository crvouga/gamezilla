import { runCapture } from '../subprocess';
import { CfAccountId } from './cf-account-id';
import { CfApiToken } from './cf-api-token';
import { PsServiceTokenId, PsServiceToken } from './ps-credentials';
import { PsDatabase } from './ps-database';
import { PsOrg } from './ps-org';
import type { SecretEntry } from './types';

export { validateSecret } from './types';
export type { SecretEntry } from './types';

const SECRET_MAP: ReadonlyArray<SecretEntry> = [
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

/**
 * Lists every secret name in the active Doppler project/config.
 * Uses `--json` to avoid parsing the CLI's human-formatted table output.
 */
export function listDopplerSecretNames(): ReadonlyArray<string> {
  const raw = runCapture('doppler', ['secrets', '--json']);
  const parsed: unknown = JSON.parse(raw);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return [];
  }
  return Object.keys(parsed as Record<string, unknown>);
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
