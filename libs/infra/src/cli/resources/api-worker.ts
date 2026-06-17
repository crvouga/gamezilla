import { assert } from '@pkgs/assert';
import { COMMIT_HASH_HEX_REGEX, assertCommitDateIso } from '@pkgs/git';
import { VaultCli } from '@pkgs/vault';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  assertExpoTokenPresent,
  publishClientEasUpdate,
  resolveEasProfile,
  resolveEasProfileWithNotice,
} from '../lib/eas-mobile';
import {
  deleteProductionWorker,
  isDoMigrationStateError,
  readLatestWranglerLogTail,
} from '../lib/cloudflare-worker-lifecycle';
import { ok, warn } from '../lib/fmt';
import { productionOrigin } from '../lib/infra-outputs';
import { REPO_ROOT } from '../paths';
import type { CiPlatform } from '../platform/platform';
import { cfAccountId } from '../secrets/cloudflare';
import {
  runAsync,
  runCapture,
  runCaptureAsync,
} from '../subprocess';
import { ResourceBase, type InfraContext } from './types';

const WRANGLER_ENV = 'production';

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

function wranglerArgs(...args: string[]): string[] {
  return ['--env', WRANGLER_ENV, ...args];
}

function resolveCommitHash(): string {
  const rawSha = runCapture('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT });
  const commitHash = rawSha.trim().toLowerCase();
  assert.ok(
    COMMIT_HASH_HEX_REGEX.test(commitHash),
    'api-worker: git HEAD must be a valid lowercase hex commit SHA',
    { rawSha }
  );
  return commitHash;
}

function resolveCommitDate(): string {
  const rawDate = runCapture('git', ['log', '-1', '--format=%cI', 'HEAD'], {
    cwd: REPO_ROOT,
  });
  const commitDate = rawDate.trim();
  assertCommitDateIso(commitDate);
  return commitDate;
}

async function buildClientForWorker(
  platform: CiPlatform,
  commitHash: string,
  commitDate: string
): Promise<void> {
  const clientDir = join(REPO_ROOT, 'apps/client');
  const apiUrl = productionOrigin();

  await runAsync(platform, 'bun', ['run', 'build'], {
    cwd: clientDir,
    label: 'api-worker: expo export (client static assets)',
    env: {
      ...process.env,
      EXPO_PUBLIC_API_URL: apiUrl,
      EXPO_PUBLIC_COMMIT_HASH: commitHash,
      EXPO_PUBLIC_COMMIT_DATE: commitDate,
    },
  });
}

function cleanupClientDist(): void {
  rmSync(join(REPO_ROOT, 'apps/client/dist'), {
    recursive: true,
    force: true,
  });
}

export class ApiWorkerResource extends ResourceBase {
  readonly id = 'api-worker';

  async provision(_platform: CiPlatform, _ctx: InfraContext): Promise<void> {}

  async dryRun(platform: CiPlatform, _ctx: InfraContext): Promise<void> {
    await this.validateVaultForDeploy();
    const commitHash = resolveCommitHash();
    const commitDate = resolveCommitDate();

    await buildClientForWorker(platform, commitHash, commitDate);

    const apiDir = join(REPO_ROOT, 'apps/api');
    try {
      await runAsync(
        platform,
        'wrangler',
        wranglerArgs('deploy', '--dry-run'),
        {
          cwd: apiDir,
          env: wranglerEnv(),
          label: 'api-worker: Cloudflare Workers deploy (dry-run)',
        }
      );
    } finally {
      cleanupClientDist();
    }

    if (resolveEasProfile() !== null) {
      assertExpoTokenPresent();
      assert.nonEmptyString(
        process.env['EXPO_PUBLIC_API_URL'] ?? productionOrigin(),
        'EXPO_PUBLIC_API_URL must be set for the EAS OTA update (Vault/env); ' +
          'a missing value blank-screens the published bundle on launch'
      );
      ok(
        'api-worker dry-run',
        'EXPO_TOKEN + EXPO_PUBLIC_API_URL present for EAS OTA update'
      );
    }

    ok(
      'api-worker dry-run',
      'client bundle + worker bindings validated locally'
    );
  }

  async deploy(platform: CiPlatform, _ctx: InfraContext): Promise<void> {
    const apiDir = join(REPO_ROOT, 'apps/api');
    const env = wranglerEnv();
    const commitHash = resolveCommitHash();
    const commitDate = resolveCommitDate();

    const vaultCfg = await this.validateVaultForDeploy();

    await buildClientForWorker(platform, commitHash, commitDate);

    const secretArgs = wranglerArgs('secret', 'put');
    await runCaptureAsync('wrangler', [...secretArgs, 'VAULT_TOKEN'], {
      cwd: apiDir,
      env,
      input: vaultCfg.token,
    });
    await runCaptureAsync('wrangler', [...secretArgs, 'VAULT_PROJECT'], {
      cwd: apiDir,
      env,
      input: vaultCfg.project,
    });
    await runCaptureAsync('wrangler', [...secretArgs, 'VAULT_CONFIG'], {
      cwd: apiDir,
      env,
      input: vaultCfg.config,
    });
    await runCaptureAsync('wrangler', [...secretArgs, 'VAULT_ADDR'], {
      cwd: apiDir,
      env,
      input: vaultCfg.addr,
    });

    platform.notice(
      'VAULT_TOKEN + VAULT_PROJECT/CONFIG/ADDR secrets pushed to Workers.'
    );

    try {
      await deployProductionWorker(platform, apiDir, env);
    } finally {
      cleanupClientDist();
    }

    platform.notice(
      'Worker deployed with API routes + client static assets on gamezilla.app / www.gamezilla.app.'
    );
  }

  /**
   * Mobile half of the client deploy: publish an OTA `eas update`. Runs after
   * the unified Worker (API + web) is live and smoke-tested.
   */
  async publishEasUpdate(
    platform: CiPlatform,
    _ctx: InfraContext
  ): Promise<void> {
    const profile = resolveEasProfileWithNotice(platform);
    if (profile === null) return;
    await publishClientEasUpdate(platform, profile);
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
    deleteProductionWorker();
  }
}

/**
 * Deploy the production Worker. If Cloudflare rejects the DO migration because
 * an earlier deploy recorded migration tags without exporting the class (the
 * pre-fix `[env.production]` gap), delete the script and retry once so
 * migrations apply against a clean slate.
 */
async function deployProductionWorker(
  platform: CiPlatform,
  apiDir: string,
  env: NodeJS.ProcessEnv
): Promise<void> {
  const deployArgs = wranglerArgs('deploy');
  const label = 'api-worker: Cloudflare Workers deploy (API + static assets)';

  let deployFailed = false;
  try {
    await runAsync(platform, 'wrangler', deployArgs, {
      cwd: apiDir,
      env,
      label,
    });
  } catch {
    deployFailed = true;
  }
  if (!deployFailed) return;

  if (!isDoMigrationStateError(readLatestWranglerLogTail())) {
    assert.fail(`${label} failed`);
  }

  warn(
    'DO migration',
    'script migration state is inconsistent with exports — deleting worker and redeploying'
  );
  platform.notice(
    'Resetting the production Worker script (Durable Object storage is wiped). ' +
      'This is a one-time recovery from deploys that ran before ROOM bindings ' +
      'were wired into `[env.production]`.'
  );
  deleteProductionWorker();

  await runAsync(platform, 'wrangler', deployArgs, {
    cwd: apiDir,
    env,
    label,
  });
}
