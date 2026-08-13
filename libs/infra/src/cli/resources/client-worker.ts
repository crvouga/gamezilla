// @io-wall-ok — composition-root wall FS via ObjectStore migration pending
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { assert } from '@pkgs/assert';
import { assertCommitDateIso, COMMIT_HASH_HEX_REGEX } from '@pkgs/git';
import { PROJECT_CONFIG } from '../../project-config';
import {
  deleteLegacyWorkerScripts,
  deleteWorkerByName,
} from '../lib/cloudflare-worker-lifecycle';
import { ok } from '../lib/fmt';
import { productionApiOrigin } from '../lib/infra-outputs';
import { REPO_ROOT } from '../paths';
import type { CiPlatform } from '../platform/platform';
import { cfAccountId } from '../secrets/cloudflare';
import { runAsync, runCapture } from '../subprocess';
import { type InfraContext, ResourceBase } from './types';

const WRANGLER_ENV = 'production';

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
    'client-worker: git HEAD must be a valid lowercase hex commit SHA',
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

function clientDir(): string {
  return join(REPO_ROOT, 'apps/client');
}

function cleanupClientDist(): void {
  rmSync(join(clientDir(), 'dist'), {
    recursive: true,
    force: true,
  });
}

async function buildClientWeb(
  platform: CiPlatform,
  commitHash: string,
  commitDate: string
): Promise<void> {
  const apiUrl = productionApiOrigin();
  const buildEnv: NodeJS.ProcessEnv = {
    ...process.env,
    EXPO_PUBLIC_API_URL: apiUrl,
    EXPO_PUBLIC_COMMIT_HASH: commitHash,
    EXPO_PUBLIC_COMMIT_DATE: commitDate,
  };

  await runAsync(platform, 'bun', ['run', 'check:production-env'], {
    cwd: clientDir(),
    label: 'client-worker: production client build env gate',
    env: buildEnv,
  });

  await runAsync(platform, 'bun', ['run', 'build'], {
    cwd: clientDir(),
    label: 'client-worker: expo export (static web assets)',
    env: buildEnv,
  });

  await runAsync(platform, 'bun', ['run', 'check:production-dist'], {
    cwd: clientDir(),
    label: 'client-worker: production web dist API URL gate',
    env: buildEnv,
  });
}

export class ClientWorkerResource extends ResourceBase {
  readonly id = 'client-worker';

  async provision(_platform: CiPlatform, _ctx: InfraContext): Promise<void> {}

  async dryRun(platform: CiPlatform, _ctx: InfraContext): Promise<void> {
    const commitHash = resolveCommitHash();
    const commitDate = resolveCommitDate();

    await buildClientWeb(platform, commitHash, commitDate);

    try {
      await runAsync(
        platform,
        'wrangler',
        wranglerArgs('deploy', '--dry-run'),
        {
          cwd: clientDir(),
          env: wranglerEnv(),
          label: 'client-worker: Cloudflare Workers deploy (dry-run)',
        }
      );
    } finally {
      cleanupClientDist();
    }

    ok('client-worker dry-run', 'client bundle + assets-only worker validated');
  }

  async deploy(platform: CiPlatform, _ctx: InfraContext): Promise<void> {
    const commitHash = resolveCommitHash();
    const commitDate = resolveCommitDate();

    await buildClientWeb(platform, commitHash, commitDate);

    deleteLegacyWorkerScripts();
    try {
      await runAsync(platform, 'wrangler', wranglerArgs('deploy'), {
        cwd: clientDir(),
        env: wranglerEnv(),
        label: 'client-worker: Cloudflare Workers deploy (static assets)',
      });
    } finally {
      cleanupClientDist();
    }

    platform.notice(
      'Client Worker deployed (assets-only) on gamezilla.app / www.gamezilla.app.'
    );
  }

  destroy(): void {
    deleteLegacyWorkerScripts();
    deleteWorkerByName(PROJECT_CONFIG.cloudflare.clientWorker);
  }
}
