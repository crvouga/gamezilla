import { assert } from '@pkgs/assert';
import { COMMIT_HASH_HEX_REGEX } from '@pkgs/git';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { PROJECT_CONFIG } from '../../project-config';
import { cleanupPagesDeployments } from '../lib/cloudflare-pages-deployments';
import {
  assertExpoTokenPresent,
  publishClientEasUpdate,
  resolveEasProfile,
  resolveEasProfileWithNotice,
} from '../lib/eas-mobile';
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

    // When the EAS OTA update will run, fail fast now (before the web client
    // + API have shipped) on a missing token or a missing API URL. A missing
    // EXPO_PUBLIC_API_URL would otherwise bundle a dev OTA that blank-screens
    // on launch (see apps/client/src/config/api-servers.ts).
    if (resolveEasProfile() !== null) {
      assertExpoTokenPresent();
      assert.nonEmptyString(
        process.env['EXPO_PUBLIC_API_URL'],
        'EXPO_PUBLIC_API_URL must be set for the EAS OTA update (Doppler/env); ' +
          'a missing value blank-screens the published bundle on launch'
      );
      ok('client dry-run', 'EXPO_TOKEN + EXPO_PUBLIC_API_URL present for EAS OTA update');
    }
  }

  async deploy(platform: CiPlatform, ctx: InfraContext): Promise<void> {
    const { apiUrl: _apiUrl, commitHash } = this.validateBuildInputs(
      platform,
      ctx
    );
    const outputs = infraOutputs(ctx);
    const pagesProject = outputs.pages_project_name;

    const clientDir = join(REPO_ROOT, 'apps/client');

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

    rmSync(join(REPO_ROOT, 'apps/client/dist'), {
      recursive: true,
      force: true,
    });

    platform.notice('Client exported and deployed to Cloudflare Pages.');
  }

  /**
   * Mobile half of the client deploy: publish an OTA `eas update`. Kept
   * separate from {@link deploy} (web → Cloudflare Pages) because it must run
   * *after* the API deploy, migrate, stripe-sync, smoke, and refresh-config —
   * the mobile client targets the live API, so a freshly-shipped bundle must
   * never reach a not-yet-migrated server. Native binaries are NOT built here
   * (rare, manual `build-client-native` command); a routine `main` push is
   * almost always JS-only.
   *
   * Skips with a notice when no EAS profile resolves (local `infra deploy`
   * without an explicit `EAS_PROFILE`), so a developer never publishes an
   * update by accident.
   */
  async publishEasUpdate(
    platform: CiPlatform,
    _ctx: InfraContext
  ): Promise<void> {
    const profile = resolveEasProfileWithNotice(platform);
    if (profile === null) return;
    await publishClientEasUpdate(platform, profile);
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

    const projectName = PROJECT_CONFIG.cloudflare.clientPagesProject;
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
