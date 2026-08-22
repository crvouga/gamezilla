// @io-wall-ok — composition-root wall FS via ObjectStore migration pending
import { join } from 'node:path';
import { PROJECT_CONFIG } from '../../project-config';
import { deleteWorkerByName } from '../lib/cloudflare-worker-lifecycle';
import { ok } from '../lib/fmt';
import { REPO_ROOT } from '../paths';
import type { CiPlatform } from '../platform/platform';
import { cfAccountId } from '../secrets/cloudflare';
import { runAsync } from '../subprocess';
import { type InfraContext, ResourceBase } from './types';

const WRANGLER_ENV = 'production';

function roomDir(): string {
  return join(REPO_ROOT, 'apps/room-server');
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

/**
 * Owns `RoomServerDurableObject` (`gamezilla-room-production`). The API
 * Worker binds cross-script via `script_name`; this resource must deploy
 * before `api-worker`.
 */
export class RoomWorkerResource extends ResourceBase {
  readonly id = 'room-worker';

  async provision(_platform: CiPlatform, _ctx: InfraContext): Promise<void> {}

  async dryRun(platform: CiPlatform, _ctx: InfraContext): Promise<void> {
    await runAsync(platform, 'wrangler', wranglerArgs('deploy', '--dry-run'), {
      cwd: roomDir(),
      env: wranglerEnv(),
      label: 'room-worker: Cloudflare Workers deploy (dry-run)',
    });
    ok('room-worker dry-run', 'room durable object worker validated locally');
  }

  async deploy(platform: CiPlatform, _ctx: InfraContext): Promise<void> {
    await runAsync(platform, 'wrangler', wranglerArgs('deploy'), {
      cwd: roomDir(),
      env: wranglerEnv(),
      label: 'room-worker: Cloudflare Workers deploy',
    });
    platform.notice(
      `Room Worker deployed (${PROJECT_CONFIG.cloudflare.roomWorker}).`
    );
  }

  destroy(): void {
    deleteWorkerByName(PROJECT_CONFIG.cloudflare.roomWorker);
  }
}
