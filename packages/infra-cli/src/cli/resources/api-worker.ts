import { join } from 'node:path';
import { ok, warn } from '../lib/fmt';
import { REPO_ROOT } from '../paths';
import { cfAccountId } from '../secrets/cloudflare';
import { runSafe } from '../subprocess';
import type { Resource } from './types';

export class ApiWorkerResource implements Resource {
  readonly id = 'api-worker';

  destroy(): void {
    const apiDir = join(REPO_ROOT, 'packages/api');
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      CLOUDFLARE_ACCOUNT_ID: cfAccountId(),
    };

    const r = runSafe('wrangler', ['delete', '--force'], {
      cwd: apiDir,
      env,
    });

    if (r.exitCode === 0) {
      ok('Worker deleted', 'gamezilla-api');
    } else {
      warn('Worker delete', r.stderr.trim() || 'may already be gone');
    }
  }
}
