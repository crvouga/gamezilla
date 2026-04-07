import { info, ok, warn } from '../lib/fmt';
import { PROJECT_CONFIG } from '../../project-config';
import { cfAccountId, cfHeaders } from '../secrets/cloudflare';
import type { Resource } from './types';

const CF_API = 'https://api.cloudflare.com/client/v4';

export class DnsZoneResource implements Resource {
  readonly id = 'dns-zone';

  async destroy(): Promise<void> {
    const accountId = cfAccountId();
    const headers = cfHeaders();
    if (!accountId) {
      warn('DNS zone', 'missing account ID — skipping');
      return;
    }

    const zoneId = await this.findZone(headers);
    if (!zoneId) {
      ok('DNS zone', 'not found — nothing to delete');
      return;
    }

    await this.purgeDnsRecords(zoneId, headers);
    await this.purgeRulesets(zoneId, headers);

    const res = await fetch(`${CF_API}/zones/${zoneId}`, {
      method: 'DELETE',
      headers,
    });

    if (res.ok) {
      ok('DNS zone deleted', PROJECT_CONFIG.domain);
    } else {
      const body = await res.text();
      warn('DNS zone delete', `HTTP ${res.status}: ${body}`);
    }
  }

  private async findZone(
    headers: Record<string, string>
  ): Promise<string | null> {
    const res = await fetch(
      `${CF_API}/zones?name=${PROJECT_CONFIG.domain}&per_page=1`,
      { headers }
    );
    if (!res.ok) {
      warn('DNS zone lookup', `HTTP ${res.status}`);
      return null;
    }

    const body = (await res.json()) as {
      result?: Array<{ id: string; name: string }>;
    };
    const match = body.result?.find(
      (z) => z.name === PROJECT_CONFIG.domain
    );
    return match?.id ?? null;
  }

  private async purgeDnsRecords(
    zoneId: string,
    headers: Record<string, string>
  ): Promise<void> {
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

  private async purgeRulesets(
    zoneId: string,
    headers: Record<string, string>
  ): Promise<void> {
    const res = await fetch(`${CF_API}/zones/${zoneId}/rulesets`, {
      headers,
    });
    if (!res.ok) return;

    const body = (await res.json()) as {
      result?: Array<{ id: string; name: string; kind: string }>;
    };
    const rulesets = (body.result ?? []).filter((r) => r.kind === 'zone');
    if (rulesets.length === 0) return;

    for (const rs of rulesets) {
      const del = await fetch(
        `${CF_API}/zones/${zoneId}/rulesets/${rs.id}`,
        { method: 'DELETE', headers }
      );
      if (del.ok || del.status === 404) {
        info('Deleted ruleset', rs.name);
      } else {
        warn('Ruleset delete', `${rs.name} — HTTP ${del.status}`);
      }
    }
  }
}
