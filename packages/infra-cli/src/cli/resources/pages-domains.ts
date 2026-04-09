import { ok, warn } from '../lib/fmt';
import { PROJECT_CONFIG } from '../../project-config';
import { cfAccountId, cfHeaders } from '../secrets/cloudflare';
import type { CiPlatform } from '../platform/platform';
import type { InfraContext, Resource } from './types';

const CF_API = 'https://api.cloudflare.com/client/v4';

const REQUIRED_DOMAINS: readonly string[] = [
  PROJECT_CONFIG.domain,
  `www.${PROJECT_CONFIG.domain}`,
];

export class PagesDomainResource implements Resource {
  readonly id = 'pages-domains';

  dependsOn(): readonly string[] {
    return ['pages-project'];
  }

  async ensure(_platform: CiPlatform, _ctx: InfraContext): Promise<void> {
    const accountId = cfAccountId();
    const headers = cfHeaders();
    const project = PROJECT_CONFIG.cloudflare.pagesProject;
    const base = `${CF_API}/accounts/${accountId}/pages/projects/${project}/domains`;

    const listRes = await fetch(base, { headers });
    if (!listRes.ok) {
      if (listRes.status === 404) {
        warn('Pages domains', 'project not found — skipping');
        return;
      }
      const text = await listRes.text();
      throw new Error(`Pages domains list failed: HTTP ${listRes.status} — ${text}`);
    }

    const body = (await listRes.json()) as {
      result?: Array<{ name: string }>;
    };
    const existing = new Set((body.result ?? []).map((d) => d.name));

    for (const domain of REQUIRED_DOMAINS) {
      if (existing.has(domain)) {
        ok('Pages domain', `${domain} (exists)`);
        continue;
      }

      const create = await fetch(base, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: domain }),
      });

      if (create.ok || create.status === 409) {
        ok('Pages domain', `${domain} (${create.status === 409 ? 'already attached' : 'attached'})`);
      } else {
        const text = await create.text();
        warn('Pages domain', `${domain} — HTTP ${create.status}: ${text}`);
      }
    }
  }

  async destroy(): Promise<void> {
    const accountId = cfAccountId();
    const headers = cfHeaders();
    if (!accountId) {
      warn('Pages domains', 'missing account ID — skipping');
      return;
    }

    const project = PROJECT_CONFIG.cloudflare.pagesProject;
    const base = `${CF_API}/accounts/${accountId}/pages/projects/${project}/domains`;

    const listRes = await fetch(base, { headers });
    if (!listRes.ok) {
      if (listRes.status === 404) return;
      warn('Pages domains list', `HTTP ${listRes.status}`);
      return;
    }

    const body = (await listRes.json()) as {
      result?: Array<{ name: string }>;
    };
    const domains = body.result ?? [];

    for (const { name } of domains) {
      const delRes = await fetch(`${base}/${name}`, {
        method: 'DELETE',
        headers,
      });
      if (delRes.ok || delRes.status === 404) {
        ok('Detached domain', name);
      } else {
        warn('Detach domain', `${name} — HTTP ${delRes.status}`);
      }
    }
  }
}
