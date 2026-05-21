import { assert } from '@pkgs/assert';
import { PROJECT_CONFIG } from '../../project-config';
import { info, ok, warn } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import { cfHeaders } from '../secrets/cloudflare';
import { ResourceBase, type InfraContext } from './types';

const CF_API = 'https://api.cloudflare.com/client/v4';

interface RequiredCname {
  readonly name: string;
  readonly content: string;
  /** Cloudflare: false = DNS-only; true = proxied (Pages apex/www). */
  readonly proxied: boolean;
}

/** Legacy custom-domain CNAMEs for the previous hosted-auth vendor — deleted on deploy if still present. */
function legacyVendorAuthCnameHostnames(domain: string): readonly string[] {
  return [
    `accounts.${domain}`,
    `clerk.${domain}`,
    `clk._domainkey.${domain}`,
    `clk2._domainkey.${domain}`,
    `clkmail.${domain}`,
  ];
}

/** One-shot cleanup after migrating hosted auth DNS. */
async function deleteLegacyVendorAuthCnameRecords(
  zoneId: string,
  headers: Record<string, string>,
  domain: string
): Promise<void> {
  const res = await fetch(
    `${CF_API}/zones/${zoneId}/dns_records?per_page=100&type=CNAME`,
    { headers }
  );
  if (!res.ok) return;

  const body = (await res.json()) as {
    result?: Array<{
      id: string;
      name: string;
      content: string;
      type: string;
    }>;
  };
  const existing = body.result ?? [];
  const legacy = new Set(legacyVendorAuthCnameHostnames(domain));
  for (const e of existing) {
    if (e.type !== 'CNAME') continue;
    const normalized = e.name.replace(/\.$/, '');
    if (!legacy.has(normalized)) continue;
    if (!e.content.includes('clerk.services')) continue;

    const del = await fetch(`${CF_API}/zones/${zoneId}/dns_records/${e.id}`, {
      method: 'DELETE',
      headers,
    });
    if (del.ok || del.status === 404) {
      ok('DNS CNAME (legacy vendor auth removed)', normalized);
    } else {
      warn(
        'DNS legacy vendor auth delete',
        `${normalized} — HTTP ${del.status}`
      );
    }
  }
}

export class DnsRecordsResource extends ResourceBase {
  readonly id = 'dns-records';

  async provision(_platform: CiPlatform, ctx: InfraContext): Promise<void> {
    assert.ok(
      !!ctx.zoneId,
      'dns-records: ctx.zoneId must be set by ZoneResource'
    );
    assert.ok(
      !!ctx.pagesSubdomain,
      'dns-records: ctx.pagesSubdomain must be set by PagesProjectResource'
    );

    const headers = cfHeaders();
    const zoneId = ctx.zoneId;
    const domain = PROJECT_CONFIG.domain;

    const required: RequiredCname[] = [
      { name: domain, content: ctx.pagesSubdomain, proxied: true },
      { name: `www.${domain}`, content: ctx.pagesSubdomain, proxied: true },
    ];

    const res = await fetch(
      `${CF_API}/zones/${zoneId}/dns_records?per_page=100&type=CNAME`,
      { headers }
    );
    assert.ok(res.ok, `DNS records list failed: HTTP ${res.status}`);

    const body = (await res.json()) as {
      result?: Array<{
        id: string;
        name: string;
        content: string;
        type: string;
        proxied?: boolean;
      }>;
    };
    const existing = body.result ?? [];

    for (const rec of required) {
      const match = existing.find(
        (e) => e.name === rec.name && e.type === 'CNAME'
      );

      const proxied = match?.proxied ?? false;
      if (match && match.content === rec.content && proxied === rec.proxied) {
        ok('DNS CNAME', `${rec.name} → ${rec.content} (exists)`);
        continue;
      }

      if (match) {
        const update = await fetch(
          `${CF_API}/zones/${zoneId}/dns_records/${match.id}`,
          {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              content: rec.content,
              proxied: rec.proxied,
            }),
          }
        );
        assert.ok(
          update.ok,
          `DNS record update failed for ${rec.name}: HTTP ${update.status}`
        );
        ok('DNS CNAME', `${rec.name} → ${rec.content} (updated)`);
        continue;
      }

      const create = await fetch(`${CF_API}/zones/${zoneId}/dns_records`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type: 'CNAME',
          name: rec.name === domain ? '@' : rec.name,
          content: rec.content,
          proxied: rec.proxied,
          ttl: 1,
        }),
      });
      assert.ok(
        create.ok,
        `DNS record create failed for ${rec.name}: HTTP ${create.status}`
      );
      ok('DNS CNAME', `${rec.name} → ${rec.content} (created)`);
    }

    await deleteLegacyVendorAuthCnameRecords(zoneId, headers, domain);
  }

  async destroy(_platform: CiPlatform): Promise<void> {
    const headers = cfHeaders();
    const zoneId = await this.findZoneId(headers);
    if (!zoneId) return;

    const res = await fetch(
      `${CF_API}/zones/${zoneId}/dns_records?per_page=100`,
      { headers }
    );
    if (!res.ok) return;

    const body = (await res.json()) as {
      result?: Array<{ id: string; name: string; type: string }>;
    };
    const records = body.result ?? [];
    if (records.length === 0) return;

    for (const rec of records) {
      const del = await fetch(
        `${CF_API}/zones/${zoneId}/dns_records/${rec.id}`,
        { method: 'DELETE', headers }
      );
      if (del.ok || del.status === 404) {
        info('Deleted DNS record', `${rec.type} ${rec.name}`);
      } else {
        warn('DNS record delete', `${rec.name} — HTTP ${del.status}`);
      }
    }
  }

  private async findZoneId(
    headers: Record<string, string>
  ): Promise<string | null> {
    const res = await fetch(
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
