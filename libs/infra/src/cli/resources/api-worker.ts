import { assert } from '@pkgs/assert';
import { VaultCli } from '@pkgs/vault';
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

type VaultDeployConfig = {
  token: string;
  project: string;
  config: string;
  addr: string;
};

function resolveVaultConfigForDeploy(): VaultDeployConfig {
  const cli = new VaultCli({ cwd: REPO_ROOT });
  let token: string;

  const fromEnv = (process.env['VAULT_TOKEN'] ?? '').trim();
  if (fromEnv.length > 0) {
    token = fromEnv;
  } else {
    try {
      token = cli.resolveToken().token;
    } catch {
      assert.fail(
        'VAULT_TOKEN is required for API Worker deploy. Set VAULT_TOKEN in env (e.g. CI), or run `vault login` so ~/.vault-token is populated.'
      );
    }
  }

  const scope = cli.resolveScope();
  const project = (process.env['VAULT_PROJECT'] ?? '').trim() || scope.project;
  const config = (process.env['VAULT_CONFIG'] ?? '').trim() || scope.config;
  const addr = (process.env['VAULT_ADDR'] ?? '').trim() || scope.addr;

  if (!project || !config) {
    assert.fail(
      `VAULT_PROJECT and VAULT_CONFIG are required. ` +
        `Resolved project=${project || '(missing)'}, config=${config || '(missing)'}. ` +
        `Set them in env or run \`vault setup --project personal --config prd\`.`
    );
  }

  return { token, project, config, addr };
}

async function preflightVaultKvRead(cfg: VaultDeployConfig): Promise<void> {
  const base = cfg.addr.replace(/\/$/, '');
  const url = `${base}/v1/secret/data/${cfg.project}/${cfg.config}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Vault-Token': cfg.token,
        Accept: 'application/json',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    assert.fail(
      `Vault preflight: network error reaching KV API — ${msg}. ` +
        `The Worker would fail at boot with the same token. Fix connectivity or token before deploying.`
    );
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.text();
      if (body.length > 0) detail += `: ${body.slice(0, 500)}`;
    } catch {
      /* body read failed */
    }

    const hint =
      response.status === 403 || response.status === 401
        ? ' (token may be expired, revoked, or lack read access to the path)'
        : response.status === 404
          ? ' (secret path may not exist — run the Vault→Vault migration helper)'
          : '';

    assert.fail(
      `Vault preflight failed: ${detail}.${hint} ` +
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

  async dryRun(platform: CiPlatform, _ctx: InfraContext): Promise<void> {
    await this.validateVaultForDeploy();

    const apiDir = join(REPO_ROOT, 'apps/api');
    await runAsync(platform, 'wrangler', ['deploy', '--dry-run'], {
      cwd: apiDir,
      env: wranglerEnv(),
      label: 'workers-api: Cloudflare Workers deploy (dry-run)',
    });

    ok('workers-api dry-run', 'bundle + bindings validated locally');
  }

  async deploy(platform: CiPlatform, _ctx: InfraContext): Promise<void> {
    const apiDir = join(REPO_ROOT, 'apps/api');
    const env = wranglerEnv();

    const vaultCfg = await this.validateVaultForDeploy();

    await runCaptureAsync('wrangler', ['secret', 'put', 'VAULT_TOKEN'], {
      cwd: apiDir,
      env,
      input: vaultCfg.token,
    });
    await runCaptureAsync('wrangler', ['secret', 'put', 'VAULT_PROJECT'], {
      cwd: apiDir,
      env,
      input: vaultCfg.project,
    });
    await runCaptureAsync('wrangler', ['secret', 'put', 'VAULT_CONFIG'], {
      cwd: apiDir,
      env,
      input: vaultCfg.config,
    });
    await runCaptureAsync('wrangler', ['secret', 'put', 'VAULT_ADDR'], {
      cwd: apiDir,
      env,
      input: vaultCfg.addr,
    });

    platform.notice(
      'VAULT_TOKEN + VAULT_PROJECT/CONFIG/ADDR secrets pushed to Workers.'
    );

    await runAsync(platform, 'wrangler', ['deploy'], {
      cwd: apiDir,
      env,
      label: 'workers-api: Cloudflare Workers deploy',
    });

    platform.notice('Workers API deployed.');
  }

  private async validateVaultForDeploy(): Promise<VaultDeployConfig> {
    const vaultCfg = resolveVaultConfigForDeploy();
    await preflightVaultKvRead(vaultCfg);
    ok(
      'Vault preflight',
      `token + project=${vaultCfg.project} config=${vaultCfg.config} verified`
    );
    return vaultCfg;
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
