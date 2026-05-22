import { runCapture } from '../subprocess';
import { ApiUrl } from './api-url';
import { BetterAuthAppName } from './better-auth-app-name';
import { BetterAuthSecret } from './better-auth-secret';
import { BetterAuthTrustedOrigins } from './better-auth-trusted-origins';
import { CfAccountId } from './cf-account-id';
import { CfApiToken } from './cf-api-token';
import { DbUrl } from './db-url';
import { PsServiceToken, PsServiceTokenId } from './ps-credentials';
import { StripeSecretKey } from './stripe-secret-key';
import { StripeWebhookSecret } from './stripe-webhook-secret';
import {
  TurboCache,
  TurboLogOrder,
  TurboTeam,
  TurboToken,
} from './turbo-token';
import type { SecretEntry } from './types';
import { WebClientGoogleClientId } from './web-client-google-client-id';
import { WebClientGoogleClientSecret } from './web-client-google-client-secret';

export { validateSecret } from './types';
export type { SecretEntry } from './types';

const SECRET_MAP: ReadonlyArray<SecretEntry> = [
  new CfApiToken(),
  new CfAccountId(),
  new PsServiceTokenId(),
  new PsServiceToken(),
  new DbUrl(),
  new ApiUrl(),
  new BetterAuthSecret(),
  new BetterAuthAppName(),
  new BetterAuthTrustedOrigins(),
  new WebClientGoogleClientId(),
  new WebClientGoogleClientSecret(),
  new StripeSecretKey(),
  new StripeWebhookSecret(),
  new TurboToken(),
  new TurboTeam(),
  new TurboCache(),
  new TurboLogOrder(),
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
 * Deletes a secret from the active Doppler config. Idempotent on the
 * Doppler side (`--yes` skips the confirmation prompt; deleting an
 * already-missing key returns 0).
 */
export function deleteDopplerSecret(name: string): void {
  runCapture('doppler', ['secrets', 'delete', name, '--yes']);
}

/** Counterpart to {@link deleteDopplerSecret} — delete from a specific config. */
export function deleteDopplerSecretIn(config: string, name: string): void {
  runCapture('doppler', [
    'secrets',
    'delete',
    name,
    '--yes',
    '--config',
    config,
  ]);
}

/**
 * Read a secret from a *specific* Doppler config (not the active one).
 * Used to mirror values across configs (e.g. prod → local) so secrets
 * shared between server and CI/dev don't drift.
 */
export function fetchDopplerSecretFrom(config: string, name: string): string {
  return runCapture('doppler', [
    'secrets',
    'get',
    name,
    '--plain',
    '--config',
    config,
  ]);
}

/** Counterpart to {@link fetchDopplerSecretFrom} — write into a specific config. */
export function setDopplerSecretIn(
  config: string,
  name: string,
  value: string
): void {
  runCapture('doppler', [
    'secrets',
    'set',
    `${name}=${value}`,
    '--config',
    config,
  ]);
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

export function loadSecretsIntoEnv(): Array<{
  env: string;
  set: boolean;
  optional: boolean;
}> {
  const results: Array<{ env: string; set: boolean; optional: boolean }> = [];

  for (const entry of SECRET_MAP) {
    const { secretKey: doppler, env } = entry;
    const optional = entry.optional === true;
    try {
      const value = fetchDopplerSecret(doppler);
      process.env[env] = value;
      results.push({ env, set: true, optional });
    } catch {
      results.push({ env, set: false, optional });
    }
  }

  return results;
}
