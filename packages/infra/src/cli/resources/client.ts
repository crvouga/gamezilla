import { assert } from '@gamezilla/lib/assert';
import { COMMIT_HASH_HEX_REGEX } from '@gamezilla/lib/commit-hash-regex';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { PROJECT_CONFIG } from '../../project-config';
import { cleanupPagesDeployments } from '../lib/cloudflare-pages-deployments';
import { ok, warn } from '../lib/fmt';
import { infraOutputs } from '../lib/infra-outputs';
import { REPO_ROOT } from '../paths';
import type { CiPlatform } from '../platform/platform';
import { cfAccountId, cfHeaders } from '../secrets/cloudflare';
import { runAsync, runCapture } from '../subprocess';
import { ResourceBase, type InfraContext } from './types';

function wranglerEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CLOUDFLARE_ACCOUNT_ID: cfAccountId(),
  };
}

export class ClientResource extends ResourceBase {
  readonly id = 'client';

  async provision(_platform: CiPlatform, _ctx: InfraContext): Promise<void> {}

  /**
   * `wrangler pages deploy` has no `--dry-run` and the Expo build is too
   * expensive to run twice per CI job, so the dry-run only checks the cheap
   * preconditions that would otherwise blow up mid-build or mid-upload. Any
   * build-time failure still shows up at `deploy`, but by then the earlier
   * Workers in the pipeline have also been dry-run-validated, so we fail in a
   * consistent place rather than after turbo-cache has already shipped.
   */
  async dryRun(platform: CiPlatform, ctx: InfraContext): Promise<void> {
    this.validateBuildInputs(platform, ctx);
    ok('client dry-run', 'API URL + commit SHA validated');
  }

  async deploy(platform: CiPlatform, ctx: InfraContext): Promise<void> {
    const { apiUrl: _apiUrl, commitHash } = this.validateBuildInputs(
      platform,
      ctx
    );
    const outputs = infraOutputs(ctx);
    const pagesProject = outputs.pages_project_name;

    const clientDir = join(REPO_ROOT, 'packages/client');

    await runAsync(platform, 'bun', ['run', 'build'], {
      cwd: clientDir,
      label: 'client: expo export',
      env: {
        ...process.env,
        EXPO_PUBLIC_COMMIT_HASH: commitHash,
      },
    });

    await runAsync(
      platform,
      'wrangler',
      [
        'pages',
        'deploy',
        'dist/',
        '--project-name',
        pagesProject,
        '--branch',
        'main',
        '--commit-dirty',
        'true',
      ],
      {
        cwd: clientDir,
        env: wranglerEnv(),
        label: 'client: Cloudflare Pages deploy',
      }
    );

    rmSync(join(REPO_ROOT, 'packages/client/dist'), {
      recursive: true,
      force: true,
    });

    platform.notice('Client exported and deployed to Cloudflare Pages.');
  }

  /**
   * Shared between `dryRun` and `deploy`. Kept cheap and side-effect-free:
   * no build, no network — only local validation of inputs that must be in
   * the right shape for the Pages deploy to succeed.
   */
  private validateBuildInputs(
    platform: CiPlatform,
    ctx: InfraContext
  ): { apiUrl: string; commitHash: string } {
    const outputs = infraOutputs(ctx);
    const apiUrl = toHttps(outputs.api_url);

    if (!/^https:\/\//.test(apiUrl)) {
      platform.error(`API_URL must be https:// (got: ${apiUrl})`);
      assert.fail('client: API URL must be https://');
    }

    const rawSha = runCapture('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT });
    const commitHash = rawSha.trim().toLowerCase();
    assert.ok(
      COMMIT_HASH_HEX_REGEX.test(commitHash),
      'client: git HEAD must be a valid lowercase hex commit SHA',
      { rawSha }
    );

    return { apiUrl, commitHash };
  }

  async destroy(): Promise<void> {
    const accountId = cfAccountId();
    if (!accountId) {
      ok(
        'Client',
        'missing Cloudflare account id — skipping deployments cleanup'
      );
      return;
    }

    const projectName = PROJECT_CONFIG.cloudflare.pagesProject;
    try {
      await cleanupPagesDeployments({
        accountId,
        projectName,
        headers: cfHeaders(),
        // For teardown we want the fewest leftovers before project delete.
        deleteAliased: true,
      });
      ok('Client', `Pages deployments cleaned for ${projectName}`);
    } catch (e) {
      warn(
        'Client',
        `Pages deployments cleanup failed: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
}

function toHttps(raw: string): string {
  let host = raw.trim();
  if (host.startsWith('https://')) host = host.slice('https://'.length);
  if (host.startsWith('http://')) host = host.slice('http://'.length);
  return `https://${host}`;
}
