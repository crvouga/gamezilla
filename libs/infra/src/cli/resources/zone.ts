import { assert } from '@pkgs/assert';
import { PROJECT_CONFIG } from '../../project-config';
import { cliHttp } from '../lib/cli-io';
import { ok, warn } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import { cfAccountId, cfHeaders } from '../secrets/cloudflare';
import { type InfraContext, ResourceBase } from './types';

const CF_API = 'https://api.cloudflare.com/client/v4';

export class ZoneResource extends ResourceBase {
  readonly id = 'zone';

  async provision(_platform: CiPlatform, ctx: InfraContext): Promise<void> {
    const headers = cfHeaders();
    const domain = PROJECT_CONFIG.domain;

    const res = await cliHttp.fetch(
      `${CF_API}/zones?name=${domain}&per_page=1`,
      {
        headers,
      }
    );
    assert.ok(res.ok, `Zone lookup failed: HTTP ${res.status}`);

    const body = (await res.json()) as {
      result?: Array<{ id: string; name: string; name_servers: string[] }>;
    };
    const existing = body.result?.find((z) => z.name === domain);

    if (existing) {
      ctx.zoneId = existing.id;
      ctx.nameservers = existing.name_servers;
      ok('Zone', `${domain} (exists)`);
      return;
    }

    const create = await cliHttp.fetch(`${CF_API}/zones`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        account: { id: cfAccountId() },
        name: domain,
        type: 'full',
      }),
    });
    assert.ok(create.ok, `Zone create failed: HTTP ${create.status}`);

    const created = (await create.json()) as {
      result: { id: string; name_servers: string[] };
    };
    ctx.zoneId = created.result.id;
    ctx.nameservers = created.result.name_servers;
    ok('Zone', `${domain} (created)`);
  }

  async destroy(): Promise<void> {
    const headers = cfHeaders();
    if (!cfAccountId()) {
      warn('Zone', 'missing account ID — skipping');
      return;
    }

    const zoneId = await this.findZone(headers);
    if (!zoneId) {
      ok('Zone', 'not found — nothing to delete');
      return;
    }

    const res = await cliHttp.fetch(`${CF_API}/zones/${zoneId}`, {
      method: 'DELETE',
      headers,
    });

    if (res.ok) {
      ok('Zone deleted', PROJECT_CONFIG.domain);
    } else {
      const body = await res.text();
      warn('Zone delete', `HTTP ${res.status}: ${body}`);
    }
  }

  private async findZone(
    headers: Record<string, string>
  ): Promise<string | null> {
    const res = await cliHttp.fetch(
      `${CF_API}/zones?name=${PROJECT_CONFIG.domain}&per_page=1`,
      { headers }
    );
    if (!res.ok) return null;

    const body = (await res.json()) as {
      result?: Array<{ id: string; name: string }>;
    };
    return (
      body.result?.find((z) => z.name === PROJECT_CONFIG.domain)?.id ?? null
    );
  }
}
