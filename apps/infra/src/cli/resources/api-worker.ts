import { assert } from '@gamezilla/lib/assert';
import { DopplerCli } from '@gamezilla/lib/doppler';
import { join } from 'node:path';
import { PROJECT_CONFIG } from '../../project-config';
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

const KNOWN_TOKEN_PREFIXES = ['dp.st.', 'dp.ct.', 'dp.pt.', 'dp.sa.'] as const;
const CONFIG_SCOPED_TOKEN_PREFIX = 'dp.st.';
const DOPPLER_DOWNLOAD_URL =
  'https://api.doppler.com/v3/configs/config/secrets/download';

type DopplerDeployConfig = {
  token: string;
  project: string | null;
  config: string | null;
};

function assertKnownTokenFormat(token: string): void {
  const recognized = KNOWN_TOKEN_PREFIXES.some((p) => token.startsWith(p));
  if (!recognized) {
    assert.fail(
      `DOPPLER_TOKEN has unrecognized prefix "${token.slice(0, 6)}…". ` +
        `Expected one of: ${KNOWN_TOKEN_PREFIXES.join(', ')}. ` +
        `This will fail at runtime. Use a valid Doppler service/CLI/personal token.`
    );
  }
}

/**
 * Resolve the Doppler token (and optional project/config scope) to push to the
 * Worker. Config-scoped service tokens (`dp.st.…`) carry their scope
 * implicitly; all other token types (CLI `dp.ct.…`, personal `dp.pt.…`, etc.)
 * need explicit `project` and `config` params or the Doppler download API
 * returns HTTP 400.
 */
function resolveDopplerConfigForDeploy(): DopplerDeployConfig {
  const cli = new DopplerCli();
  let token: string;

  const fromEnv = (process.env['DOPPLER_TOKEN'] ?? '').trim();
  if (fromEnv.length > 0) {
    token = fromEnv;
  } else {
    try {
      token = cli.resolveToken().token;
    } catch {
      assert.fail(
        'DOPPLER_TOKEN is required for API Worker deploy. Set DOPPLER_TOKEN in env (e.g. CI), or run `doppler login` / `doppler configure` so `doppler configure get token --plain` works.'
      );
    }
  }

  assertKnownTokenFormat(token);

  if (token.startsWith(CONFIG_SCOPED_TOKEN_PREFIX)) {
    return { token, project: null, config: null };
  }

  const project =
    (process.env['DOPPLER_PROJECT'] ?? '').trim() ||
    cli.tryConfigureGetProjectPlain();
  const config =
    (process.env['DOPPLER_CONFIG'] ?? '').trim() ||
    cli.tryConfigureGetConfigPlain();

  if (!project || !config) {
    assert.fail(
      `DOPPLER_TOKEN is not a config-scoped service token (dp.st.…) so DOPPLER_PROJECT and DOPPLER_CONFIG are required. ` +
        `Resolved project=${project ?? '(missing)'}, config=${config ?? '(missing)'}. ` +
        `Either use a config-scoped service token, or set DOPPLER_PROJECT / DOPPLER_CONFIG in env, or run \`doppler configure\`.`
    );
  }

  return { token, project, config };
}

/**
 * Hit the Doppler secrets-download API with the exact same token+scope that the
 * Worker will use at runtime. If this fails, the Worker would fail too — abort
 * the deploy now instead of shipping a broken config to production.
 */
async function preflightDopplerDownload(
  cfg: DopplerDeployConfig
): Promise<void> {
  const params = new URLSearchParams({ format: 'json' });
  if (cfg.project !== null) params.set('project', cfg.project);
  if (cfg.config !== null) params.set('config', cfg.config);

  let response: Response;
  try {
    response = await fetch(`${DOPPLER_DOWNLOAD_URL}?${params}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        Accept: 'application/json',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    assert.fail(
      `Doppler preflight: network error reaching secrets-download API — ${msg}. ` +
        `The Worker would fail at boot with the same token. Fix connectivity or token before deploying.`
    );
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.text();
      if (body.length > 0) detail += `: ${body.slice(0, 500)}`;
    } catch {
      /* body read failed, status is enough */
    }

    const hint =
      response.status === 400
        ? ' (HTTP 400 usually means a non–config-scoped token without project/config params, or wrong project/config slug)'
        : response.status === 401 || response.status === 403
          ? ' (token may be expired, revoked, or scoped to a different project)'
          : '';

    assert.fail(
      `Doppler preflight failed: ${detail}.${hint} ` +
        `Aborting deploy — the Worker would return "api misconfigured" at runtime with this token.`
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

    const doppler = resolveDopplerConfigForDeploy();

    await preflightDopplerDownload(doppler);
    ok(
      'Doppler preflight',
      doppler.project !== null
        ? `token + project=${doppler.project} config=${doppler.config} verified`
        : 'config-scoped service token verified'
    );

    await runCaptureAsync('wrangler', ['secret', 'put', 'DOPPLER_TOKEN'], {
      cwd: apiDir,
      env,
      input: doppler.token,
    });

    if (doppler.project !== null) {
      await runCaptureAsync(
        'wrangler',
        ['secret', 'put', 'DOPPLER_PROJECT'],
        { cwd: apiDir, env, input: doppler.project }
      );
    }
    if (doppler.config !== null) {
      await runCaptureAsync(
        'wrangler',
        ['secret', 'put', 'DOPPLER_CONFIG'],
        { cwd: apiDir, env, input: doppler.config }
      );
    }

    platform.notice(
      doppler.project !== null
        ? 'DOPPLER_TOKEN + DOPPLER_PROJECT/CONFIG secrets pushed to Workers (non–config-scoped token).'
        : 'DOPPLER_TOKEN secret pushed to Workers (config-scoped service token).'
    );

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
      ok('Worker deleted', PROJECT_CONFIG.cloudflare.apiWorker);
    } else {
      warn('Worker delete', r.stderr.trim() || 'unexpected failure');
    }
  }
}

function isNotFound(r: SpawnResult): boolean {
  return NOT_FOUND_CODES.some((code) => r.stderr.includes(`[code: ${code}]`));
}
