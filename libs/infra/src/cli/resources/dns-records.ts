import { assert } from '@pkgs/assert';
import { PROJECT_CONFIG } from '../../project-config';
import { info, ok, warn } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import { cfHeaders } from '../secrets/cloudflare';
import { ResourceBase, type InfraContext } from './types';

const CF_API = 'https://api.cloudflare.com/client/v4';

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

function isPagesDevCname(content: string): boolean {
  return content.endsWith('.pages.dev') || content.includes('.pages.dev');
}

/**
 * Removes apex/www CNAMEs that pointed at the retired Cloudflare Pages project
 * so `wrangler deploy --env production` can attach Worker custom domains.
 */
async function deleteLegacyPagesCnameRecords(
  zoneId: string,
  headers: Record<string, string>,
  domain: string
): Promise<void> {
  const targets = new Set([domain, `www.${domain}`]);
  const res = await fetch(
    `${CF_API}/zones/${zoneId}/dns_records?per_page=100&type=CNAME`,
    { headers }
  );
  if (!res.ok) return;

  const body = (await res.json()) as {
    result?: Array<{ id: string; name: string; content: string; type: string }>;
  };

  for (const rec of body.result ?? []) {
    if (rec.type !== 'CNAME') continue;
    const normalized = rec.name.replace(/\.$/, '');
    if (!targets.has(normalized)) continue;
    if (!isPagesDevCname(rec.content)) continue;

    const del = await fetch(`${CF_API}/zones/${zoneId}/dns_records/${rec.id}`, {
      method: 'DELETE',
      headers,
    });
    if (del.ok || del.status === 404) {
      ok('DNS CNAME (legacy Pages removed)', `${normalized} → ${rec.content}`);
    } else {
      warn('DNS legacy Pages delete', `${normalized} — HTTP ${del.status}`);
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

    const headers = cfHeaders();
    const zoneId = ctx.zoneId;
    const domain = PROJECT_CONFIG.domain;

    await deleteLegacyPagesCnameRecords(zoneId, headers, domain);
    await deleteLegacyVendorAuthCnameRecords(zoneId, headers, domain);

    ok(
      'DNS',
      `legacy Pages CNAME cleanup complete (Worker custom domains for www/api managed by wrangler)`
    );
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
