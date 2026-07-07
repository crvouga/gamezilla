import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SECRETS_DEFAULTS, type SecretsConfigFile } from './defaults';

const PLACEHOLDER_WORKSPACE_IDS = new Set([
  'REPLACE_ME',
  'CHANGEME',
  'TODO',
  'YOUR_PROJECT_ID',
]);

function assertValidWorkspaceId(workspaceId: string): void {
  if (PLACEHOLDER_WORKSPACE_IDS.has(workspaceId.toUpperCase())) {
    throw new Error(
      `.infisical.json workspaceId is still "${workspaceId}". Run ` +
        '`infisical init --domain https://app.infisical.com` in the repo root ' +
        '(or paste the project ID from Infisical → Project Settings → Copy Project ID).'
    );
  }
}

function parseConfig(raw: string): SecretsConfigFile {
  const parsed: unknown = JSON.parse(raw);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('.infisical.json must be a JSON object');
  }
  const obj = parsed as Record<string, unknown>;
  const workspaceId = obj['workspaceId'];
  if (typeof workspaceId !== 'string' || workspaceId.trim().length === 0) {
    throw new Error('.infisical.json: workspaceId is required');
  }
  const defaultEnvironment = obj['defaultEnvironment'];
  const domain = obj['domain'];
  return {
    workspaceId: workspaceId.trim(),
    ...(typeof defaultEnvironment === 'string'
      ? { defaultEnvironment: defaultEnvironment.trim() }
      : {}),
    ...(typeof domain === 'string' ? { domain: domain.trim() } : {}),
  };
}

export function resolveSecretsConfigPath(repoRoot: string): string {
  return join(repoRoot, '.infisical.json');
}

export function readSecretsConfig(repoRoot: string): SecretsConfigFile {
  const path = resolveSecretsConfigPath(repoRoot);
  return parseConfig(readFileSync(path, 'utf8'));
}

function readTrimmedEnv(name: string): string {
  return (process.env[name] ?? '').trim();
}

function resolveSecretsEnv(
  envOverride: string | null | undefined,
  file: SecretsConfigFile
): string {
  const override = envOverride?.trim();
  if (override) return override;

  const fromEnv = readTrimmedEnv('SECRETS_ENV');
  if (fromEnv) return fromEnv;

  const fromFile = file.defaultEnvironment?.trim();
  if (fromFile) return fromFile;

  return SECRETS_DEFAULTS.env;
}

function resolveSecretsDomain(file: SecretsConfigFile): string {
  const fromEnv = readTrimmedEnv('SECRETS_ADDR');
  if (fromEnv) return fromEnv;

  const fromFile = file.domain?.trim();
  if (fromFile) return fromFile;

  return SECRETS_DEFAULTS.domain;
}

function resolveWorkspaceId(file: SecretsConfigFile): string {
  return readTrimmedEnv('SECRETS_PROJECT_ID') || file.workspaceId;
}

export function resolveSecretsScope(
  repoRoot: string,
  envOverride?: string | null
): {
  readonly workspaceId: string;
  readonly env: string;
  readonly domain: string;
} {
  const file = readSecretsConfig(repoRoot);
  const workspaceId = resolveWorkspaceId(file);
  assertValidWorkspaceId(workspaceId);
  return {
    workspaceId,
    env: resolveSecretsEnv(envOverride, file),
    domain: resolveSecretsDomain(file),
  };
}
