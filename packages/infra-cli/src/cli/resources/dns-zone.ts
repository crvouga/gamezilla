import { ok, warn } from '../lib/fmt';
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

    const zoneId = await this.findZone(accountId, headers);
    if (!zoneId) {
      ok('DNS zone', 'not found — nothing to delete');
      return;
    }

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
    accountId: string,
    headers: Record<string, string>
  ): Promise<string | null> {
    const url = `${CF_API}/zones?account.id=${accountId}&name=${PROJECT_CONFIG.domain}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return null;

    const body = (await res.json()) as {
      result?: Array<{ id: string }>;
    };
    return body.result?.[0]?.id ?? null;
  }
}
