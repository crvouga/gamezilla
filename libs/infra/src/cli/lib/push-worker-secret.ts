import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { REPO_ROOT } from '../paths';
import { cfAccountId } from '../secrets/cloudflare';
import { runCapture } from '../subprocess';

const WRANGLER_ENV = 'production';
const API_DIR = join(REPO_ROOT, 'apps/api');

function wranglerEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CLOUDFLARE_ACCOUNT_ID: cfAccountId(),
  };
}

function wranglerArgs(...args: string[]): string[] {
  return ['--env', WRANGLER_ENV, ...args];
}

/**
 * Push a single Worker secret binding after stripe sync rotates the webhook
 * signing secret (Worker was deployed with the previous value).
 */
export function pushWorkerSecretBinding(
  secretName: string,
  secretValue: string
): void {
  const trimmed = secretValue.trim();
  if (trimmed.length === 0) {
    throw new Error(`pushWorkerSecretBinding: ${secretName} is blank`);
  }
  const bulkPath = join(tmpdir(), `wrangler-secret-${process.pid}.json`);
  writeFileSync(bulkPath, JSON.stringify({ [secretName]: trimmed }), 'utf8');
  try {
    runCapture('wrangler', wranglerArgs('secret', 'bulk', bulkPath), {
      cwd: API_DIR,
      env: wranglerEnv(),
    });
  } finally {
    rmSync(bulkPath, { force: true });
  }
}
