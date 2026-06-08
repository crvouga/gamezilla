import {
  readVaultYamlDefaults,
  resolveVaultYamlPath,
} from '@pkgs/vault/vault-yaml';
import { REPO_ROOT } from '../paths';
import { runCapture } from '../subprocess';
import { ApiUrl } from './api-url';
import {
  B2ApplicationKey,
  B2ApplicationKeyId,
  B2BucketName,
  B2S3Endpoint,
  B2S3Region,
} from './b2-credentials';
import { BetterAuthAppName } from './better-auth-app-name';
import { BetterAuthSecret } from './better-auth-secret';
import { CfAccountId } from './cf-account-id';
import { CfApiToken } from './cf-api-token';
import { DbUrl } from './db-url';
import { ExpoToken } from './expo-token';
import { PsServiceToken, PsServiceTokenId } from './ps-credentials';
import { StripeSecretKey } from './stripe-secret-key';
import { StripeWebhookSecret } from './stripe-webhook-secret';
import {
  TurboApi,
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
  new WebClientGoogleClientId(),
  new WebClientGoogleClientSecret(),
  new StripeSecretKey(),
  new StripeWebhookSecret(),
  new TurboApi(),
  new TurboToken(),
  new TurboTeam(),
  new TurboCache(),
  new TurboLogOrder(),
  new ExpoToken(),
  new B2ApplicationKeyId(),
  new B2ApplicationKey(),
  new B2BucketName(),
  new B2S3Endpoint(),
  new B2S3Region(),
];

type VaultCoords = {
  readonly mount: string;
  readonly project: string;
  readonly config: string;
};

function resolveVaultCoords(configOverride?: string): VaultCoords {
  const yaml = readVaultYamlDefaults(resolveVaultYamlPath(REPO_ROOT));
  const mount = process.env['VAULT_MOUNT']?.trim() || yaml.mount;
  const project = process.env['VAULT_PROJECT']?.trim() || yaml.project;
  const config =
    configOverride?.trim() ||
    process.env['VAULT_CONFIG']?.trim() ||
    yaml.config;
  return { mount, project, config };
}

function kvPath(configOverride?: string): string {
  const { project, config } = resolveVaultCoords(configOverride);
  return `${project}/${config}`;
}

export function getSecretMap(): ReadonlyArray<SecretEntry> {
  return SECRET_MAP;
}

export function fetchVaultSecret(name: string): string {
  const { mount } = resolveVaultCoords();
  return runCapture('vault', [
    'kv',
    'get',
    `-mount=${mount}`,
    `-field=${name}`,
    kvPath(),
  ]);
}

export function vaultSecretExists(name: string): boolean {
  try {
    const value = fetchVaultSecret(name);
    return value !== '';
  } catch {
    return false;
  }
}

export function setVaultSecret(name: string, value: string): void {
  const { mount } = resolveVaultCoords();
  runCapture('vault', [
    'kv',
    'patch',
    `-mount=${mount}`,
    kvPath(),
    `${name}=${value}`,
  ]);
}

export function deleteVaultSecret(name: string): void {
  const { mount } = resolveVaultCoords();
  runCapture('vault', [
    'kv',
    'patch',
    `-mount=${mount}`,
    `-delete=${name}`,
    kvPath(),
  ]);
}

export function deleteVaultSecretIn(config: string, name: string): void {
  const { mount } = resolveVaultCoords(config);
  runCapture('vault', [
    'kv',
    'patch',
    `-mount=${mount}`,
    `-delete=${name}`,
    kvPath(config),
  ]);
}

export function fetchVaultSecretFrom(config: string, name: string): string {
  const { mount } = resolveVaultCoords(config);
  return runCapture('vault', [
    'kv',
    'get',
    `-mount=${mount}`,
    `-field=${name}`,
    kvPath(config),
  ]);
}

export function setVaultSecretIn(
  config: string,
  name: string,
  value: string
): void {
  const { mount } = resolveVaultCoords(config);
  runCapture('vault', [
    'kv',
    'patch',
    `-mount=${mount}`,
    kvPath(config),
    `${name}=${value}`,
  ]);
}

export function listVaultSecretNames(
  configOverride?: string
): ReadonlyArray<string> {
  const { mount } = resolveVaultCoords(configOverride);
  const raw = runCapture('vault', [
    'kv',
    'get',
    `-mount=${mount}`,
    '-format=json',
    kvPath(configOverride),
  ]);
  const parsed: unknown = JSON.parse(raw);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return [];
  }
  const root = parsed as Record<string, unknown>;
  const dataWrapper = root['data'];
  if (
    dataWrapper === null ||
    typeof dataWrapper !== 'object' ||
    Array.isArray(dataWrapper)
  ) {
    return [];
  }
  const inner = (dataWrapper as Record<string, unknown>)['data'];
  if (inner === null || typeof inner !== 'object' || Array.isArray(inner)) {
    return [];
  }
  return Object.keys(inner as Record<string, unknown>);
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
    try {
      const value = fetchVaultSecret(secretKey);
      process.env[env] = value;
      results.push({ env, set: true, optional });
    } catch {
      results.push({ env, set: false, optional });
    }
  }

  return results;
}
