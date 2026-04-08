import { join } from 'node:path';
import { ok, warn } from '../lib/fmt';
import { REPO_ROOT } from '../paths';
import { cfAccountId } from '../secrets/cloudflare';
import { runSafe, type SpawnResult } from '../subprocess';
import type { Resource } from './types';

const NOT_FOUND_CODES = [10000, 10007, 10090];

export class TurboCacheResource implements Resource {
  readonly id = 'turbo-cache';

  destroy(): void {
    const cacheDir = join(REPO_ROOT, 'packages/turbo-cache');
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      CLOUDFLARE_ACCOUNT_ID: cfAccountId(),
    };

    const r = runSafe('wrangler', ['delete', '--force'], {
      cwd: cacheDir,
      env,
    });

    if (r.exitCode === 0 || isNotFound(r)) {
      ok('Worker deleted', 'gamezilla-turbo-cache');
    } else {
      warn('Worker delete', r.stderr.trim() || 'unexpected failure');
    }
  }
}

function isNotFound(r: SpawnResult): boolean {
  return NOT_FOUND_CODES.some((code) => r.stderr.includes(`[code: ${code}]`));
}
