import { assert } from '@gamezilla/lib/assert';
import { DopplerCli } from '@gamezilla/lib/doppler';
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

/**
 * Token pushed to the Worker as `DOPPLER_TOKEN`: env override, else same
 * resolution as `apps/api/scripts/setup-dev-vars.ts` (CLI token).
 * Not stored as a Doppler secret named `DOPPLER_TOKEN` (meta / chicken-egg).
 */
function resolveDopplerTokenForDeploy(): string {
  const fromEnv = (process.env['DOPPLER_TOKEN'] ?? '').trim();
  if (fromEnv.length > 0) return fromEnv;
  try {
    return new DopplerCli().resolveToken().token;
  } catch {
    assert.fail(
      'DOPPLER_TOKEN is required for API Worker deploy. Set DOPPLER_TOKEN in env (e.g. CI), or run `doppler login` / `doppler configure` so `doppler configure get token --plain` works.'
    );
  }
}

function wranglerEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CLOUDFLARE_ACCOUNT_ID: cfAccountId(),
  };
}

export class ApiWorkerResource extends ResourceBase {
  readonly id = 'api-worker';

  async provision(_platform: CiPlatform, _ctx: InfraContext): Promise<void> {}

  async deploy(platform: CiPlatform, _ctx: InfraContext): Promise<void> {
    const apiDir = join(REPO_ROOT, 'apps/api');
    const env = wranglerEnv();

    const dopplerToken = resolveDopplerTokenForDeploy();
    const dbUrl = (process.env['DB_URL'] ?? '').trim();
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
