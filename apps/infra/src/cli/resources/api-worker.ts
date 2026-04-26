import { assert } from '@gamezilla/lib/assert';
import { join } from 'node:path';
import { ok, warn } from '../lib/fmt';
import { REPO_ROOT } from '../paths';
import type { CiPlatform } from '../platform/platform';
import { cfAccountId } from '../secrets/cloudflare';
import {
  runAsync,
  runCaptureAsync,
  runSafe,
  type SpawnResult,
} from '../subprocess';
import { ResourceBase, type InfraContext } from './types';

const NOT_FOUND_CODES = [10000, 10007, 10090];

function wranglerEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CLOUDFLARE_ACCOUNT_ID: process.env['TF_VAR_cloudflare_account_id'],
  };
}

export class ApiWorkerResource extends ResourceBase {
  readonly id = 'api-worker';

  async provision(_platform: CiPlatform, _ctx: InfraContext): Promise<void> {}

  async deploy(platform: CiPlatform, _ctx: InfraContext): Promise<void> {
    const apiDir = join(REPO_ROOT, 'apps/api');
    const env = wranglerEnv();

    const dopplerToken = (process.env['DOPPLER_TOKEN'] ?? '').trim();
    const dbUrl = (process.env['DB_URL'] ?? '').trim();

    assert.nonEmptyString(
      dopplerToken,
      'DOPPLER_TOKEN must be set so the API Worker can resolve runtime secrets from Doppler'
    );
    assert.nonEmptyString(
      dbUrl,
      'DB_URL must be set (e.g. after PlanetScale provision) before deploying the API Worker'
    );

    await runCaptureAsync('wrangler', ['secret', 'put', 'DOPPLER_TOKEN'], {
      cwd: apiDir,
      env,
      input: dopplerToken,
    });
    platform.notice('DOPPLER_TOKEN secret pushed to Workers.');

    await runCaptureAsync('wrangler', ['secret', 'put', 'DB_URL'], {
      cwd: apiDir,
      env,
      input: dbUrl,
    });
    platform.notice('DB_URL secret pushed to Workers.');

    await runAsync(platform, 'wrangler', ['deploy'], {
      cwd: apiDir,
      env,
      label: 'workers-api: Cloudflare Workers deploy',
    });

    platform.notice('Workers API deployed.');
  }

  destroy(): void {
    const apiDir = join(REPO_ROOT, 'apps/api');
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      CLOUDFLARE_ACCOUNT_ID: cfAccountId(),
    };

    const r = runSafe('wrangler', ['delete', '--force'], {
      cwd: apiDir,
      env,
    });

    if (r.exitCode === 0 || isNotFound(r)) {
      ok('Worker deleted', 'gamezilla-api');
    } else {
      warn('Worker delete', r.stderr.trim() || 'unexpected failure');
    }
  }
}

function isNotFound(r: SpawnResult): boolean {
  return NOT_FOUND_CODES.some((code) => r.stderr.includes(`[code: ${code}]`));
}
