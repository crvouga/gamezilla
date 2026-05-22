import { assert } from '@pkgs/assert';
import { PROJECT_CONFIG } from '../../project-config';
import { cleanupPagesDeployments } from '../lib/cloudflare-pages-deployments';
import { ok, warn } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import { cfAccountId, cfHeaders } from '../secrets/cloudflare';
import { runSafe, type SpawnResult } from '../subprocess';
import { ResourceBase, type InfraContext } from './types';

const CF_API = 'https://api.cloudflare.com/client/v4';
const NOT_FOUND_CODES = [8000007];

/**
 * Cloudflare Pages project that hosts the web client (`apps/client`).
 * A Cloudflare account can host multiple Pages projects, so each gets
 * its own resource keyed by name (`client-pages-project`,
 * `<other>-pages-project`, …) rather than a single generic
 * `pages-project` class.
 */
export class ClientPagesProjectResource extends ResourceBase {
  readonly id = 'client-pages-project';

  async provision(_platform: CiPlatform, ctx: InfraContext): Promise<void> {
    const accountId = cfAccountId();
    const headers = cfHeaders();
    const name = PROJECT_CONFIG.cloudflare.clientPagesProject;

    const res = await fetch(
      `${CF_API}/accounts/${accountId}/pages/projects/${name}`,
      { headers }
    );

    if (res.ok) {
      const body = (await res.json()) as {
        result: { subdomain: string };
      };
      ctx.pagesSubdomain = body.result.subdomain;
      ok('Pages project', `${name} (exists)`);
      return;
    }

    if (res.status !== 404) {
      const text = await res.text();
      throw new Error(
        `Pages project lookup failed: HTTP ${res.status} — ${text}`
      );
    }

    const create = await fetch(
      `${CF_API}/accounts/${accountId}/pages/projects`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name,
          production_branch: 'main',
          deployment_configs: {
            production: { compatibility_date: '2024-01-01' },
            preview: { compatibility_date: '2024-01-01' },
          },
        }),
      }
    );
    assert.ok(create.ok, `Pages project create failed: HTTP ${create.status}`);

    const created = (await create.json()) as {
      result: { subdomain: string };
    };
    ctx.pagesSubdomain = created.result.subdomain;
    ok('Pages project', `${name} (created)`);
  }

  async destroy(): Promise<void> {
    const name = PROJECT_CONFIG.cloudflare.clientPagesProject;
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
