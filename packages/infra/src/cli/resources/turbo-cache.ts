import { assert } from '@gamezilla/lib/assert';
import { join } from 'node:path';
import { PROJECT_CONFIG } from '../../project-config';
import { ok, warn } from '../lib/fmt';
import { REPO_ROOT } from '../paths';
import type { CiPlatform } from '../platform/platform';
import { cfAccountId } from '../secrets/cloudflare';
import { runAsync, runCapture, runSafe, type SpawnResult } from '../subprocess';
import { ResourceBase, type InfraContext } from './types';

const NOT_FOUND_CODES = [10000, 10007, 10090];

function wranglerEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CLOUDFLARE_ACCOUNT_ID: cfAccountId(),
  };
}

export class TurboCacheResource extends ResourceBase {
  readonly id = 'turbo-cache';

  async provision(_platform: CiPlatform, _ctx: InfraContext): Promise<void> {
    this.syncTurboToken();
  }

  async dryRun(platform: CiPlatform, _ctx: InfraContext): Promise<void> {
    // Bundle + validate the Worker locally; no Cloudflare API calls, no
    // secret writes. The TURBO_TOKEN secret is already synced by `provision`,
    // so nothing state-modifying is needed here.
    await runAsync(platform, 'wrangler', ['deploy', '--dry-run'], {
      cwd: join(REPO_ROOT, 'apps/turbo-cache'),
      env: wranglerEnv(),
      label: 'turbo-cache: Cloudflare Workers deploy (dry-run)',
    });

    ok('turbo-cache dry-run', 'bundle + bindings validated locally');
  }

  async deploy(platform: CiPlatform, _ctx: InfraContext): Promise<void> {
    this.syncTurboToken();

    await runAsync(platform, 'wrangler', ['deploy'], {
      cwd: join(REPO_ROOT, 'apps/turbo-cache'),
      env: wranglerEnv(),
      label: 'turbo-cache: Cloudflare Workers deploy',
    });

    platform.notice('Turbo remote cache deployed.');
  }

  destroy(): void {
    const cacheDir = join(REPO_ROOT, 'apps/turbo-cache');
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      CLOUDFLARE_ACCOUNT_ID: cfAccountId(),
    };

    const r = runSafe('wrangler', ['delete', '--force'], {
      cwd: cacheDir,
      env,
    });

    if (r.exitCode === 0 || isNotFound(r)) {
      ok('Worker deleted', PROJECT_CONFIG.cloudflare.turboCacheWorker);
    } else {
      warn('Worker delete', r.stderr.trim() || 'unexpected failure');
    }
  }

  private syncTurboToken(): void {
    const token = process.env['TURBO_TOKEN'] ?? '';
    assert.ok(token.length > 0, 'TURBO_TOKEN must be set');

    runCapture('wrangler', ['secret', 'put', 'TURBO_TOKEN'], {
      cwd: join(REPO_ROOT, 'apps', 'turbo-cache'),
      env: wranglerEnv(),
      input: token,
    });

    ok('TURBO_TOKEN', 'synced to turbo-cache Worker');
  }
}

function isNotFound(r: SpawnResult): boolean {
  return NOT_FOUND_CODES.some((code) => r.stderr.includes(`[code: ${code}]`));
}
