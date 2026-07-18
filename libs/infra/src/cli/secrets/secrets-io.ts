/**
 * Infisical CLI I/O — kept separate from the registry so secret definitions
 * can import fetch/set helpers without a circular dependency on `registry.ts`.
 */
import { resolveSecretsScope } from '@pkgs/secrets-config/infisical-json';
import { REPO_ROOT } from '../paths';
import { runCapture } from '../subprocess';

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

/** Quiet Cloudsmith migration banner (Homebrew installs are unaffected). */
function infisicalEnv(): NodeJS.ProcessEnv {
  return { ...process.env, INFISICAL_DISABLE_MIGRATION_NOTICE: '1' };
}

function runInfisical(args: string[]): string {
  return runCapture('infisical', args, { env: infisicalEnv() });
}

export function fetchSecret(name: string): string {
  const coords = resolveSecretsCoords();
  return runInfisical([
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
  runInfisical([
    'secrets',
    'set',
    `${name}=${value}`,
    ...infisicalBaseArgs(coords),
  ]);
}

export function deleteSecret(name: string): void {
  const coords = resolveSecretsCoords();
  runInfisical([
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
  runInfisical([
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
  return runInfisical([
    'secrets',
    'get',
    name,
    ...infisicalBaseArgs(coords),
    '--plain',
  ]);
}

export function setSecretIn(env: string, name: string, value: string): void {
  const coords = resolveSecretsCoords(env);
  runInfisical([
    'secrets',
    'set',
    `${name}=${value}`,
    ...infisicalBaseArgs(coords),
  ]);
}

export function exportSecretsMap(
  envOverride?: string
): ReadonlyMap<string, string> {
  const coords = resolveSecretsCoords(envOverride);
  const raw = runInfisical([
    'export',
    ...infisicalBaseArgs(coords),
    '--format=json',
  ]);
  const parsed: unknown = JSON.parse(raw);
  const map = new Map<string, string>();
  if (!Array.isArray(parsed)) return map;
  for (const item of parsed) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    const rec = item as Record<string, unknown>;
    const key = rec['key'];
    const value = rec['value'];
    if (typeof key === 'string' && key.length > 0 && typeof value === 'string') {
      map.set(key, value);
    }
  }
  return map;
}

export function listSecretNames(envOverride?: string): ReadonlyArray<string> {
  return [...exportSecretsMap(envOverride).keys()];
}
