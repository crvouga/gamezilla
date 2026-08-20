import { assert } from '@pkgs/assert';
import { PROJECT_CONFIG } from '../../project-config';
import { cliHttp } from '../lib/cli-io';
import { info, ok, warn } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import { cfHeaders } from '../secrets/cloudflare';
import { type InfraContext, ResourceBase } from './types';

const CF_API = 'https://api.cloudflare.com/client/v4';

export class DnsRecordsResource extends ResourceBase {
  readonly id = 'dns-records';

  async provision(_platform: CiPlatform, ctx: InfraContext): Promise<void> {
    assert.ok(
      !!ctx.zoneId,
      'dns-records: ctx.zoneId must be set by ZoneResource'
    );

    ok('DNS', 'Worker custom domains for www/api managed by wrangler');
  }

  async destroy(_platform: CiPlatform): Promise<void> {
    const headers = cfHeaders();
    const zoneId = await this.findZoneId(headers);
    if (!zoneId) return;

    const res = await cliHttp.fetch(
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
      const del = await cliHttp.fetch(
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
