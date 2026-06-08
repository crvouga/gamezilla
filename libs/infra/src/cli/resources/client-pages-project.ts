import { cleanupPagesDeployments } from '../lib/cloudflare-pages-deployments';
import { ok, warn } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import { cfAccountId, cfHeaders } from '../secrets/cloudflare';
import { runSafe, type SpawnResult } from '../subprocess';
import { ResourceBase, type InfraContext } from './types';

const NOT_FOUND_CODES = [8000007];
/** Retired Pages project — kept for idempotent `destroy()` teardown only. */
const LEGACY_CLIENT_PAGES_PROJECT = 'gamezilla-client';

/**
 * Cloudflare Pages project that hosts the web client (`apps/client`).
 * A Cloudflare account can host multiple Pages projects, so each gets
 * its own resource keyed by name (`client-pages-project`,
 * `<other>-pages-project`, …) rather than a single generic
 * `pages-project` class.
 */
export class ClientPagesProjectResource extends ResourceBase {
  readonly id = 'client-pages-project';
  override readonly routineStatus = 'destroyed';

  async provision(_platform: CiPlatform, _ctx: InfraContext): Promise<void> {}

  async destroy(): Promise<void> {
    const name = LEGACY_CLIENT_PAGES_PROJECT;
    const accountId = cfAccountId();
    const headers = cfHeaders();

    if (accountId) {
      try {
        await cleanupPagesDeployments({
          accountId,
          projectName: name,
          headers,
          deleteAliased: true,
        });
      } catch (e) {
        warn(
          'Pages deployments cleanup',
          `best-effort failed: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    } else {
      warn('Pages deployments cleanup', 'missing account ID — skipping');
    }

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      CLOUDFLARE_ACCOUNT_ID: accountId,
    };

    const r = runSafe(
      'wrangler',
      ['pages', 'project', 'delete', name, '--yes'],
      { env }
    );

    if (r.exitCode === 0 || isNotFound(r)) {
      ok('Pages project deleted', name);
    } else {
      warn('Pages project delete', r.stderr.trim() || 'unexpected failure');
    }
  }
}

function isNotFound(r: SpawnResult): boolean {
  return NOT_FOUND_CODES.some((code) => r.stderr.includes(`[code: ${code}]`));
}
