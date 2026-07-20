import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SECRETS_DEFAULTS,
  type ResolvedSecretsScope,
  type SecretsConfigFile,
} from './defaults';

const PLACEHOLDER_PROJECT_IDS = new Set([
  'REPLACE_ME',
  'CHANGEME',
  'TODO',
  'YOUR_PROJECT_ID',
]);

const CONFIG_FILENAME = '.secrets.json';

function assertValidProjectId(projectId: string): void {
  if (PLACEHOLDER_PROJECT_IDS.has(projectId.toUpperCase())) {
    throw new Error(
      `${CONFIG_FILENAME} projectId is still "${projectId}". Set a real project id ` +
        'in the repo-root secrets config (or via SECRETS_PROJECT_ID).'
    );
  }
}

function parseConfig(raw: string): SecretsConfigFile {
  const parsed: unknown = JSON.parse(raw);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${CONFIG_FILENAME} must be a JSON object`);
  }
  const obj = parsed as Record<string, unknown>;
  const projectId = obj['projectId'];
  if (typeof projectId !== 'string' || projectId.trim().length === 0) {
    throw new Error(`${CONFIG_FILENAME}: projectId is required`);
  }
  const environment = obj['environment'];
  const endpoint = obj['endpoint'];
  return {
    projectId: projectId.trim(),
    ...(typeof environment === 'string'
      ? { environment: environment.trim() }
      : {}),
    ...(typeof endpoint === 'string' ? { endpoint: endpoint.trim() } : {}),
  };
}

export function resolveSecretsConfigPath(repoRoot: string): string {
  return join(repoRoot, CONFIG_FILENAME);
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

  const fromFile = file.environment?.trim();
  if (fromFile) return fromFile;

  return SECRETS_DEFAULTS.env;
}

function resolveSecretsEndpoint(file: SecretsConfigFile): string | null {
  const fromEnv = readTrimmedEnv('SECRETS_ADDR');
  if (fromEnv) return fromEnv;

  const fromFile = file.endpoint?.trim();
  if (fromFile) return fromFile;

  return null;
}

function resolveProjectId(file: SecretsConfigFile): string {
  return readTrimmedEnv('SECRETS_PROJECT_ID') || file.projectId;
}

export function resolveSecretsScope(
  repoRoot: string,
  envOverride?: string | null
): ResolvedSecretsScope {
  const file = readSecretsConfig(repoRoot);
  const projectId = resolveProjectId(file);
  assertValidProjectId(projectId);
  return {
    projectId,
    env: resolveSecretsEnv(envOverride, file),
    endpoint: resolveSecretsEndpoint(file),
  };
}
