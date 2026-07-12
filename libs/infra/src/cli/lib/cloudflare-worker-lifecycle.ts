import { readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { currentPlatform } from '@pkgs/os';
import { PROJECT_CONFIG } from '../../project-config';
import { REPO_ROOT } from '../paths';
import { cfAccountId } from '../secrets/cloudflare';
import { runSafe, type SpawnResult } from '../subprocess';
import { ok, warn } from './fmt';

const NOT_FOUND_CODES = [10000, 10007, 10090];
const WRANGLER_ENV = 'production';
export const DO_MIGRATION_STATE_ERROR = '[code: 10074]';

export function isDoMigrationStateError(output: string): boolean {
  return (
    output.includes(DO_MIGRATION_STATE_ERROR) ||
    output.includes('was not exported in the previous version of the script')
  );
}

/** Tail of the newest wrangler log — used after a failed deploy to detect DO migration errors. */
export function readLatestWranglerLogTail(maxBytes = 20_000): string {
  const dir = wranglerLogDir();
  try {
    const files = readdirSync(dir)
      .filter((name) => name.startsWith('wrangler-') && name.endsWith('.log'))
      .map((name) => {
        const path = join(dir, name);
        return { path, mtimeMs: statSync(path).mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
    const latest = files[0];
    if (latest === undefined) return '';
    const content = readFileSync(latest.path, 'utf8');
    return content.length <= maxBytes ? content : content.slice(-maxBytes);
  } catch {
    return '';
  }
}

function wranglerLogDir(): string {
  const home = homedir();
  if (currentPlatform() === 'win32') {
    const appData = process.env['APPDATA'] ?? join(home, 'AppData', 'Roaming');
    return join(appData, '.wrangler', 'logs');
  }
  if (currentPlatform() === 'darwin') {
    return join(home, 'Library', 'Preferences', '.wrangler', 'logs');
  }
  return join(home, '.config', '.wrangler', 'logs');
}

function apiDir(): string {
  return join(REPO_ROOT, 'apps/api');
}

function wranglerEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CLOUDFLARE_ACCOUNT_ID: cfAccountId(),
  };
}

export function isWorkerNotFound(r: SpawnResult): boolean {
  return NOT_FOUND_CODES.some((code) => r.stderr.includes(`[code: ${code}]`));
}

/** Delete a Worker by explicit script name (legacy stacks, no `--env`). */
export function deleteWorkerByName(workerName: string): void {
  const r = runSafe('wrangler', ['delete', workerName, '--force'], {
    cwd: apiDir(),
    env: wranglerEnv(),
  });

  if (r.exitCode === 0 || isWorkerNotFound(r)) {
    ok('Worker deleted', workerName);
    return;
  }

  warn(
    'Worker delete',
    `${workerName}: ${r.stderr.trim() || 'unexpected failure'}`
  );
}

/** Delete the production API Worker (`wrangler.toml` `[env.production]`). */
export function deleteProductionWorker(): void {
  const r = runSafe('wrangler', ['--env', WRANGLER_ENV, 'delete', '--force'], {
    cwd: apiDir(),
    env: wranglerEnv(),
  });

  if (r.exitCode === 0 || isWorkerNotFound(r)) {
    ok('Worker deleted', PROJECT_CONFIG.cloudflare.apiWorker);
    return;
  }

  warn(
    'Worker delete',
    `${PROJECT_CONFIG.cloudflare.apiWorker}: ${r.stderr.trim() || 'unexpected failure'}`
  );
}
