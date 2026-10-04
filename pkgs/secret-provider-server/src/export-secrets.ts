/**
 * Shared Infisical CLI export helper (probe + map) for secrets-run bootstrap
 * and `secrets:pull`.
 */
import { spawnSync } from 'node:child_process';
import { parseInfisicalExportJson } from '@pkgs/secret-provider-shared/local-secrets-cache';
import { INFISICAL_CLI_BIN } from '@pkgs/secret-provider-shared/defaults';

export type InfisicalExportCoords = {
  readonly repoRoot: string;
  readonly workspaceId: string;
  readonly env: string;
  readonly domain: string;
};

function infisicalCliEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env['CURSOR_AGENT'];
  delete env['CURSOR_TRACE_ID'];
  env['INFISICAL_DISABLE_MIGRATION_NOTICE'] = '1';
  return env;
}

function infisicalProjectArgs(args: {
  readonly workspaceId: string;
  readonly env: string;
  readonly domain: string;
}): string[] {
  return [
    '--projectId',
    args.workspaceId,
    '--env',
    args.env,
    '--domain',
    args.domain,
  ];
}

/**
 * True when the Infisical CLI can fetch secrets for this project/env.
 */
export function canFetchInfisicalSecrets(args: InfisicalExportCoords): boolean {
  const result = spawnSync(
    INFISICAL_CLI_BIN,
    ['export', ...infisicalProjectArgs(args), '--format=json'],
    {
      cwd: args.repoRoot,
      env: infisicalCliEnv(),
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    }
  );
  if (result.error !== undefined || result.status !== 0) return false;
  const raw = (result.stdout ?? '').trim();
  if (raw.length === 0) return false;
  try {
    return Array.isArray(JSON.parse(raw));
  } catch {
    return false;
  }
}

/** Export secrets for one Infisical env; throws on CLI failure. */
export function exportInfisicalSecretsMap(
  args: InfisicalExportCoords
): ReadonlyMap<string, string> {
  const result = spawnSync(
    INFISICAL_CLI_BIN,
    ['export', ...infisicalProjectArgs(args), '--format=json'],
    {
      cwd: args.repoRoot,
      env: infisicalCliEnv(),
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    }
  );
  if (result.error !== undefined) {
    throw new Error(
      `${INFISICAL_CLI_BIN} export spawn failed: ${result.error.message}`
    );
  }
  if (result.status !== 0) {
    const stderr = (result.stderr ?? '').trim();
    throw new Error(
      `${INFISICAL_CLI_BIN} export exited ${String(result.status)}: ${stderr}`
    );
  }
  return parseInfisicalExportJson(result.stdout ?? '');
}
