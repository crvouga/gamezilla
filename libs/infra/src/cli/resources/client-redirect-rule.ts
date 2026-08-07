import { assert } from '@pkgs/assert';
import { PROJECT_CONFIG } from '../../project-config';
import { info, ok, warn } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import { cfHeaders } from '../secrets/cloudflare';
import { type InfraContext, ResourceBase } from './types';

const CF_API = 'https://api.cloudflare.com/client/v4';
const PHASE = 'http_request_dynamic_redirect';

export class ClientRedirectRuleResource extends ResourceBase {
  readonly id = 'client-redirect-rule';

  async provision(_platform: CiPlatform, ctx: InfraContext): Promise<void> {
    assert.ok(
      !!ctx.zoneId,
      'client-redirect-rule: ctx.zoneId must be set by ZoneResource'
    );

    const headers = cfHeaders();
    const zoneId = ctx.zoneId;
    const domain = PROJECT_CONFIG.domain;

    const res = await fetch(
      `${CF_API}/zones/${zoneId}/rulesets?phase=${PHASE}`,
      { headers }
    );

    if (res.ok) {
      const body = (await res.json()) as {
        result?: Array<{ id: string; phase: string; kind: string }>;
      };
      const existing = (body.result ?? []).find(
        (r) => r.phase === PHASE && r.kind === 'zone'
      );
      if (existing) {
        ok('Redirect rule', `apex → www (exists)`);
        return;
      }
    }

    const create = await fetch(`${CF_API}/zones/${zoneId}/rulesets`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Redirect apex to www',
        kind: 'zone',
        phase: PHASE,
        rules: [
          {
            action: 'redirect',
            action_parameters: {
              from_value: {
                status_code: 301,
                target_url: {
                  expression: `concat("https://www.${domain}", http.request.uri.path)`,
                },
                preserve_query_string: true,
              },
            },
            expression: `(http.host eq "${domain}")`,
            description: 'Redirect apex to www',
            enabled: true,
          },
        ],
      }),
    });
    assert.ok(create.ok, `Redirect rule create failed: HTTP ${create.status}`);
    ok('Redirect rule', `apex → www (created)`);
  }

  async destroy(_platform: CiPlatform): Promise<void> {
    const headers = cfHeaders();
    const zoneId = await this.findZoneId(headers);
    if (!zoneId) return;

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
      const del = await fetch(`${CF_API}/zones/${zoneId}/rulesets/${rs.id}`, {
        method: 'DELETE',
        headers,
      });
      if (del.ok || del.status === 404) {
        info('Deleted ruleset', rs.name);
      } else {
        warn('Ruleset delete', `${rs.name} — HTTP ${del.status}`);
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
