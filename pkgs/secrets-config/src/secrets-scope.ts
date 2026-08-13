import { join } from 'node:path';
import { readUtf8 } from '@pkgs/object-store/helpers';
import type { ObjectStore } from '@pkgs/object-store/interface';
import {
  type ResolvedSecretsScope,
  SECRETS_DEFAULTS,
  type SecretsConfigFile,
} from './defaults';

const PLACEHOLDER_PROJECT_IDS = new Set([
  'REPLACE_ME',
  'CHANGEME',
  'TODO',
  'YOUR_PROJECT_ID',
]);

/** RFC 4122 UUID (workspace id shape in `.secrets.json`). */
const PROJECT_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CONFIG_FILENAME = '.secrets.json';

function isProjectUuid(value: string): boolean {
  return PROJECT_UUID_RE.test(value);
}

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

export async function readSecretsConfig(
  store: ObjectStore
): Promise<SecretsConfigFile> {
  const raw = await readUtf8(store, CONFIG_FILENAME);
  if (raw === null) {
    throw new Error(`${CONFIG_FILENAME}: file not found`);
  }
  return parseConfig(raw);
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
  const fromEnv = readTrimmedEnv('SECRETS_PROJECT_ID');
  if (!fromEnv) return file.projectId;
  // CI stores the project *slug* in `vars.SECRETS_PROJECT_ID` for
  // secrets-action (`project-slug`). Machine-identity CLI export needs the
  // workspace UUID from `.secrets.json` — a slug 404s on bot lookup.
  if (isProjectUuid(file.projectId) && !isProjectUuid(fromEnv)) {
    return file.projectId;
  }
  return fromEnv;
}

export async function resolveSecretsScope(
  store: ObjectStore,
  envOverride?: string | null
): Promise<ResolvedSecretsScope> {
  const file = await readSecretsConfig(store);
  const projectId = resolveProjectId(file);
  assertValidProjectId(projectId);
  return {
    projectId,
    env: resolveSecretsEnv(envOverride, file),
    endpoint: resolveSecretsEndpoint(file),
  };
}
