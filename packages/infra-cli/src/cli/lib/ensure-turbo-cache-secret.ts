import { assert } from '@gamezilla/shared/assert';
import { join } from 'node:path';
import { REPO_ROOT } from '../paths';
import { runCapture } from '../subprocess';
import { ok } from './fmt';

/**
 * Push the TURBO_TOKEN from the current environment to the turbo-cache
 * Cloudflare Worker secret, keeping Doppler and the Worker in sync.
 *
 * Safe to call repeatedly — wrangler `secret put` is idempotent.
 */
export function ensureTurboCacheSecret(): void {
  const token = process.env['TURBO_TOKEN'] ?? '';
  assert.ok(token.length > 0, 'TURBO_TOKEN must be set');

  const cacheDir = join(REPO_ROOT, 'packages', 'turbo-cache');
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CLOUDFLARE_ACCOUNT_ID: process.env['TF_VAR_cloudflare_account_id'],
  };

  runCapture('wrangler', ['secret', 'put', 'TURBO_TOKEN'], {
    cwd: cacheDir,
    env,
    input: token,
  });

  ok('TURBO_TOKEN', 'synced to turbo-cache Worker');
}
