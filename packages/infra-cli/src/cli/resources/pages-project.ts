import { assert } from '@gamezilla/shared/assert';
import { ok, warn } from '../lib/fmt';
import { PROJECT_CONFIG } from '../../project-config';
import { cfAccountId, cfHeaders } from '../secrets/cloudflare';
import { runSafe, type SpawnResult } from '../subprocess';
import type { CiPlatform } from '../platform/platform';
import type { InfraContext, Resource } from './types';

const CF_API = 'https://api.cloudflare.com/client/v4';
const NOT_FOUND_CODES = [8000007];

export class PagesProjectResource implements Resource {
  readonly id = 'pages-project';

  async ensure(_platform: CiPlatform, ctx: InfraContext): Promise<void> {
    const accountId = cfAccountId();
    const headers = cfHeaders();
    const name = PROJECT_CONFIG.cloudflare.pagesProject;

    const res = await fetch(
      `${CF_API}/accounts/${accountId}/pages/projects/${name}`,
      { headers },
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
      throw new Error(`Pages project lookup failed: HTTP ${res.status} — ${text}`);
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
      },
    );
    assert.ok(create.ok, `Pages project create failed: HTTP ${create.status}`);

    const created = (await create.json()) as {
      result: { subdomain: string };
    };
    ctx.pagesSubdomain = created.result.subdomain;
    ok('Pages project', `${name} (created)`);
  }

  async destroy(): Promise<void> {
    const name = PROJECT_CONFIG.cloudflare.pagesProject;
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      CLOUDFLARE_ACCOUNT_ID: cfAccountId(),
    };

    const r = runSafe('wrangler', ['pages', 'project', 'delete', name, '--yes'], { env });

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
