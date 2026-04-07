import { fetchWithRetry } from '@gamezilla/shared/async/fetch-with-retry';
import type { SecretEntry } from './types';
import { cfHeaders, probeCfPermission } from './cloudflare';

export class CfApiToken implements SecretEntry {
  readonly doppler = 'CLOUDFLARE_API_TOKEN';
  readonly env = 'CLOUDFLARE_API_TOKEN';
  readonly hint = [
    'https://dash.cloudflare.com/profile/api-tokens → Create Token',
    'Start with the "Edit Zone DNS" template, then add:',
    '  Zone permissions:    DNS Edit, Zone Settings Write, Workers Routes Edit',
    '  Account permissions: Cloudflare Pages Edit, Workers Scripts Edit,',
    '                       Workers KV Storage Edit, Account Settings Read',
    'Zone Resources: All zones  |  Account Resources: All accounts',
  ].join('\n');

  async validate(token: string): Promise<string | null> {
    try {
      const headers = cfHeaders(token);

      const res = await fetchWithRetry(
        'https://api.cloudflare.com/client/v4/user/tokens/verify',
        { headers },
      );
      if (!res.ok) return `Cloudflare API returned HTTP ${res.status}`;
      const body = (await res.json()) as { result?: { status?: string } };
      if (body.result?.status !== 'active') {
        return `Token status is "${body.result?.status ?? 'unknown'}", expected "active"`;
      }

      const acctRes = await fetchWithRetry(
        'https://api.cloudflare.com/client/v4/accounts',
        { headers },
      );
      if (!acctRes.ok)
        return `Token cannot list accounts (HTTP ${acctRes.status}) — check permissions`;
      const acctBody = (await acctRes.json()) as {
        result?: Array<{ id: string }>;
      };
      if (!acctBody.result?.length)
        return 'Token has no accessible accounts — check account scope';

      const accountId = acctBody.result[0].id;

      const checks: Array<{ label: string; probe: Promise<boolean> }> = [
        {
          label: 'Account Settings Read  (Account permission — wrangler account discovery)',
          probe: probeCfPermission(
            headers,
            'GET',
            `https://api.cloudflare.com/client/v4/accounts/${accountId}`,
          ),
        },
        {
          label: 'Cloudflare Pages Edit  (Account permission)',
          probe: probeCfPermission(
            headers,
            'GET',
            `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`,
          ),
        },
        {
          label: 'Workers Scripts Edit   (Account permission)',
          probe: probeCfPermission(
            headers,
            'GET',
            `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts`,
          ),
        },
        {
          label: 'Workers KV Storage Edit (Account permission — wrangler deploy/delete)',
          probe: probeCfPermission(
            headers,
            'GET',
            `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces`,
          ),
        },
      ];

      const zonesRes = await fetchWithRetry(
        `https://api.cloudflare.com/client/v4/zones?account.id=${accountId}&per_page=1`,
        { headers },
      );
      if (zonesRes.ok) {
        const zonesBody = (await zonesRes.json()) as {
          result?: Array<{ id: string }>;
        };
        const zoneId = zonesBody.result?.[0]?.id;
        if (zoneId) {
          checks.push(
            {
              label: 'DNS Write              (Zone permission — for CNAME records)',
              probe: probeCfPermission(
                headers,
                'POST',
                `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
                { type: 'TXT', name: '_cf-probe', content: 'probe', ttl: 1 },
              ),
            },
            {
              label: 'Zone Settings Write    (Zone permission — for redirect rulesets)',
              probe: probeCfPermission(
                headers,
                'GET',
                `https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets`,
              ),
            },
            {
              label: 'Workers Routes Edit    (Zone permission — for custom domain routing)',
              probe: probeCfPermission(
                headers,
                'GET',
                `https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes`,
              ),
            },
          );
        }
      } else {
        checks.unshift({
          label: 'Zone Read              (Zone permission — list zones)',
          probe: Promise.resolve(false),
        });
      }

      const results = await Promise.all(checks.map((c) => c.probe));
      const missing = checks.filter((_, i) => !results[i]).map((c) => c.label);
      if (missing.length > 0) {
        return [
          'Token is missing permissions. Edit at:',
          'https://dash.cloudflare.com/profile/api-tokens',
          '',
          'Missing:',
          ...missing.map((p) => `  - ${p}`),
          '',
          'Tip: start with the "Edit Zone DNS" template, then add:',
          '  Zone: Workers Routes Edit',
          '  Account: Cloudflare Pages Edit, Workers Scripts Edit,',
          '           Workers KV Storage Edit, Account Settings Read',
          'Zone Resources → All zones  |  Account Resources → All accounts',
        ].join('\n');
      }

      return null;
    } catch (e) {
      return `Cloudflare API unreachable: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
}
