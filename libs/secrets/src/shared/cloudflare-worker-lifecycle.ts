// @io-wall-ok — composition-root wall FS via ObjectStore migration pending
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { PRODUCT_CONFIG } from '@libs/db/public/product-config';
import { currentPlatform } from '@pkgs/os';
import { ok, warn } from './fmt';
import { REPO_ROOT } from './paths';
import { cfAccountId } from './secrets/cloudflare';
import { runSafe } from './subprocess';
import { WRANGLER_ENV, wranglerEnv } from './wrangler-env';

const NOT_FOUND_CODES = [10000, 10007, 10090];
export const DO_MIGRATION_STATE_ERROR = '[code: 10074]';
const DO_MISSING_EXPORT_ERROR = '[code: 10064]';
const DO_DELETE_BINDING_ERROR = '[code: 10061]';

export function isDoMigrationStateError(output: string): boolean {
  return (
    output.includes(DO_MIGRATION_STATE_ERROR) ||
    output.includes(DO_MISSING_EXPORT_ERROR) ||
    output.includes(DO_DELETE_BINDING_ERROR) ||
    output.includes('was not exported in the previous version of the script') ||
    output.includes('does not export class')
  );
}

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
  return join(REPO_ROOT, 'apps/server');
}

export function isWorkerNotFound(r: { stderr: string }): boolean {
  return NOT_FOUND_CODES.some((code) => r.stderr.includes(`[code: ${code}]`));
}

const LEGACY_WORKER_SCRIPT_NAMES = [
  'gamezilla-api',
  'gamezilla-client',
] as const;

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

export function deleteLegacyWorkerScripts(): void {
  for (const name of LEGACY_WORKER_SCRIPT_NAMES) {
    deleteWorkerByName(name);
  }
}

export function deleteProductionWorker(): void {
  const r = runSafe('wrangler', ['--env', WRANGLER_ENV, 'delete', '--force'], {
    cwd: apiDir(),
    env: wranglerEnv(),
  });

  if (r.exitCode === 0 || isWorkerNotFound(r)) {
    ok('Worker deleted', PRODUCT_CONFIG.cloudflare.apiWorker);
    return;
  }

  warn(
    'Worker delete',
    `${PRODUCT_CONFIG.cloudflare.apiWorker}: ${r.stderr.trim() || 'unexpected failure'}`
  );
}

export { cfAccountId };
