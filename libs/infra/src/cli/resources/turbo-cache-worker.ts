import { assert } from '@pkgs/assert';
import { join } from 'node:path';
import { PROJECT_CONFIG } from '../../project-config';
import { info, ok, warn } from '../lib/fmt';
import { REPO_ROOT } from '../paths';
import type { CiPlatform } from '../platform/platform';
import { cfAccountId } from '../secrets/cloudflare';
import { deleteDopplerSecret, deleteDopplerSecretIn } from '../secrets/secrets';
import { runAsync, runCapture, runSafe, type SpawnResult } from '../subprocess';
import {
  ResourceBase,
  type InfraContext,
  type ResourceRoutineStatus,
} from './types';

const NOT_FOUND_CODES = [10000, 10007, 10090];

/** Doppler keys belonging to the self-hosted Turbo cache stack. Cleared in
 * both the active config (`prod`) and `local` so a future re-provision
 * starts from a clean slate without stale URLs/tokens lingering. */
const SELF_HOSTED_DOPPLER_KEYS: readonly string[] = ['TURBO_API'];

function wranglerEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CLOUDFLARE_ACCOUNT_ID: cfAccountId(),
  };
}

/**
 * Self-hosted Turborepo remote cache Worker (`apps/turbo-cache`).
 *
 * Currently `'destroyed'` — Vercel Remote Caching is the live remote
 * cache. The Worker's R2 binding is owned by
 * `TurboCacheBucketResource` (also `'destroyed'`); reverse-topo
 * destroy order means this Worker comes down first, then the bucket.
 */
export class TurboCacheWorkerResource extends ResourceBase {
  readonly id = 'turbo-cache-worker';
  override readonly routineStatus: ResourceRoutineStatus = 'destroyed';

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

  /**
   * Idempotent teardown: Worker + Doppler `TURBO_API`. The R2 bucket is
   * tracked separately by `TurboCacheBucketResource`, so leave it alone
   * here — the registry-driven `'destroyed'`-resource phase will reach
   * it after this Worker is gone.
   */
  async destroy(_platform: CiPlatform): Promise<void> {
    this.deleteWorker();
    this.deleteDopplerKeys();
  }

  private deleteWorker(): void {
    const cacheDir = join(REPO_ROOT, 'apps/turbo-cache');
    const r = runSafe('wrangler', ['delete', '--force'], {
      cwd: cacheDir,
      env: wranglerEnv(),
    });

    if (r.exitCode === 0 || isNotFound(r)) {
      ok('Worker deleted', PROJECT_CONFIG.cloudflare.turboCacheWorker);
    } else {
      warn('Worker delete', r.stderr.trim() || 'unexpected failure');
    }
  }

  /** Best-effort cleanup: Doppler errors are warn-only because keys may
   * already be gone (idempotent guarantee) and CI must not fail when the
   * stack is fully destroyed. */
  private deleteDopplerKeys(): void {
    for (const key of SELF_HOSTED_DOPPLER_KEYS) {
      try {
        deleteDopplerSecret(key);
        ok(key, 'deleted from active Doppler config');
      } catch {
        info(key, 'not present in active Doppler config');
      }
      try {
        deleteDopplerSecretIn('local', key);
        ok(key, 'deleted from Doppler local');
      } catch {
        info(key, 'not present in Doppler local');
      }
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
