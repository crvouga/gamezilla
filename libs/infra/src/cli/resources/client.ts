import { cleanupPagesDeployments } from '../lib/cloudflare-pages-deployments';
import { ok, warn } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import { cfAccountId, cfHeaders } from '../secrets/cloudflare';
import { ResourceBase, type InfraContext } from './types';

/** Retired Cloudflare Pages client deploy — kept for idempotent `destroy()`. */
const LEGACY_CLIENT_PAGES_PROJECT = 'gamezilla-client';

export class ClientResource extends ResourceBase {
  readonly id = 'client';
  override readonly routineStatus = 'destroyed';

  async provision(_platform: CiPlatform, _ctx: InfraContext): Promise<void> {}

  async destroy(): Promise<void> {
    const accountId = cfAccountId();
    if (!accountId) {
      ok(
        'Client',
        'missing Cloudflare account id — skipping deployments cleanup'
      );
      return;
    }

    try {
      await cleanupPagesDeployments({
        accountId,
        projectName: LEGACY_CLIENT_PAGES_PROJECT,
        headers: cfHeaders(),
        deleteAliased: true,
      });
      ok('Client', `Pages deployments cleaned for ${LEGACY_CLIENT_PAGES_PROJECT}`);
    } catch (e) {
      warn(
        'Client',
        `Pages deployments cleanup failed: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
}
