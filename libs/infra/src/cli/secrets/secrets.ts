import { resolveSecretsScope } from '@pkgs/secrets-config/infisical-json';
import { REPO_ROOT } from '../paths';
import { runCapture } from '../subprocess';
import { CfAccountId } from './cf-account-id';
import { CfApiToken } from './cf-api-token';
import {
  S3AccessKeyId,
  S3Bucket,
  S3Endpoint,
  S3Region,
  S3SecretAccessKey,
} from './s3-credentials';
import { AuthPublishableKey } from './auth-publishable-key';
import { AuthSecretKey } from './auth-secret-key';
import { DbUrl } from './db-url';
import { ExpoToken } from './expo-token';
import {
  PowerSyncInstanceId,
  PowerSyncJwtPublicJwk,
  PowerSyncProjectId,
  PowerSyncUrl,
  PsAdminToken,
} from './powersync-secrets';
import { StripeSecretKey } from './stripe-secret-key';
import { StripeWebhookSecret } from './stripe-webhook-secret';
import { TurboCache, TurboLogOrder, TurboTeam, TurboToken } from './turbo-token';
import type { SecretEntry } from './types';
import { API_WORKER_EXTERNALLY_MANAGED_SECRET_KEYS } from './worker-api-secrets';

export { validateSecret } from './types';
export type { SecretEntry } from './types';

const SECRET_MAP: ReadonlyArray<SecretEntry> = [
  new CfApiToken(),
  new CfAccountId(),
  new DbUrl(),
  new AuthPublishableKey(),
  new AuthSecretKey(),
  new StripeSecretKey(),
  new StripeWebhookSecret(),
  new TurboToken(),
  new TurboTeam(),
  new TurboCache(),
  new TurboLogOrder(),
  new ExpoToken(),
  new S3AccessKeyId(),
  new S3SecretAccessKey(),
  new S3Bucket(),
  new S3Endpoint(),
  new S3Region(),
  new PowerSyncInstanceId(),
  new PowerSyncProjectId(),
  new PowerSyncUrl(),
  new PsAdminToken(),
  new PowerSyncJwtPublicJwk(),
];

type SecretsCoords = {
  readonly workspaceId: string;
  readonly env: string;
  readonly domain: string;
};

function resolveSecretsCoords(envOverride?: string): SecretsCoords {
  const scope = resolveSecretsScope(REPO_ROOT, envOverride);
  return {
    workspaceId: scope.workspaceId,
    env: scope.env,
    domain: scope.domain,
  };
}

function infisicalBaseArgs(coords: SecretsCoords): string[] {
  return [
    '--projectId',
    coords.workspaceId,
    '--env',
    coords.env,
    '--domain',
    coords.domain,
  ];
}

export function getSecretMap(): ReadonlyArray<SecretEntry> {
  return SECRET_MAP;
}

export function fetchSecret(name: string): string {
  const coords = resolveSecretsCoords();
  return runCapture('infisical', [
    'secrets',
    'get',
    name,
    ...infisicalBaseArgs(coords),
    '--plain',
  ]);
}

export function secretExists(name: string): boolean {
  try {
    const value = fetchSecret(name);
    return value !== '';
  } catch {
    return false;
  }
}

export function setSecret(name: string, value: string): void {
  const coords = resolveSecretsCoords();
  runCapture('infisical', [
    'secrets',
    'set',
    `${name}=${value}`,
    ...infisicalBaseArgs(coords),
  ]);
}

export function deleteSecret(name: string): void {
  const coords = resolveSecretsCoords();
  runCapture('infisical', [
    'secrets',
    'delete',
    name,
    ...infisicalBaseArgs(coords),
    '--type',
    'shared',
  ]);
}

export function deleteSecretIn(env: string, name: string): void {
  const coords = resolveSecretsCoords(env);
  runCapture('infisical', [
    'secrets',
    'delete',
    name,
    ...infisicalBaseArgs(coords),
    '--type',
    'shared',
  ]);
}

export function fetchSecretFrom(env: string, name: string): string {
  const coords = resolveSecretsCoords(env);
  return runCapture('infisical', [
    'secrets',
    'get',
    name,
    ...infisicalBaseArgs(coords),
    '--plain',
  ]);
}

export function setSecretIn(env: string, name: string, value: string): void {
  const coords = resolveSecretsCoords(env);
  runCapture('infisical', [
    'secrets',
    'set',
    `${name}=${value}`,
    ...infisicalBaseArgs(coords),
  ]);
}

export function listSecretNames(envOverride?: string): ReadonlyArray<string> {
  const coords = resolveSecretsCoords(envOverride);
  const raw = runCapture('infisical', [
    'export',
    ...infisicalBaseArgs(coords),
    '--format=json',
  ]);
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    return [];
  }
  const names: string[] = [];
  for (const item of parsed) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    const key = (item as Record<string, unknown>)['key'];
    if (typeof key === 'string' && key.length > 0) {
      names.push(key);
    }
  }
  return names;
}

export function loadSecretsIntoEnv(): Array<{
  env: string;
  set: boolean;
  optional: boolean;
}> {
  const results: Array<{ env: string; set: boolean; optional: boolean }> = [];

  for (const entry of SECRET_MAP) {
    const { secretKey, env } = entry;
    const optional = entry.optional === true;

    const existing = process.env[env];
    if (typeof existing === 'string' && existing.trim().length > 0) {
      results.push({ env, set: true, optional });
      continue;
    }

    try {
      const value = fetchSecret(secretKey).trim();
      process.env[env] = value;
      results.push({ env, set: value.length > 0, optional });
    } catch {
      results.push({ env, set: false, optional });
    }
  }

  return results;
}

/** Worker boot secrets managed in Infisical but outside {@link getSecretMap}. */
export function loadWorkerApiSecretsIntoEnv(): Array<{
  key: string;
  set: boolean;
}> {
  const results: Array<{ key: string; set: boolean }> = [];

  for (const key of API_WORKER_EXTERNALLY_MANAGED_SECRET_KEYS) {
    const existing = process.env[key]?.trim();
    if (existing !== undefined && existing.length > 0) {
      results.push({ key, set: true });
      continue;
    }

    try {
      const value = fetchSecret(key).trim();
      process.env[key] = value;
      results.push({ key, set: value.length > 0 });
    } catch {
      results.push({ key, set: false });
    }
  }

  return results;
}
