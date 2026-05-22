import { assert } from '@pkgs/assert';
import { PROJECT_CONFIG } from '../../project-config';
import { info, ok, warn } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import { cfHeaders } from '../secrets/cloudflare';
import {
  ResourceBase,
  type InfraContext,
  type ResourceRoutineStatus,
} from './types';

const CF_API = 'https://api.cloudflare.com/client/v4';
const PHASE = 'http_request_firewall_custom';

/**
 * Description acts as our idempotency key: any existing rule with this exact
 * description is treated as "ours" and either left in place or replaced.
 */
const RULE_DESCRIPTION = 'gamezilla: skip bot challenges for turbo-cache';

/** Hostname we skip bot protections for. The endpoint is still gated by the
 * Worker's `TURBO_TOKEN` bearer auth, so skipping challenges is safe. */
function turboCacheHost(): string {
  return `turbo-cache.${PROJECT_CONFIG.domain}`;
}

type Rule = {
  id: string;
  description?: string;
  expression?: string;
  action?: string;
};

type Ruleset = {
  id: string;
  phase: string;
  kind: string;
  rules?: Rule[];
};

/**
 * Creates / maintains a WAF Custom Rule that skips bot-management and related
 * zone-level security products for requests to `turbo-cache.<domain>`.
 *
 * Why: GitHub-hosted runners trip Super Bot Fight Mode / Managed Challenge on
 * turbo's cache preflight. Skipping bot checks for this single host lets CI
 * hit the custom domain directly (no more workers.dev TURBO_API_CI remap).
 * Other hosts (www, api, apex) retain full bot protections.
 *
 * Currently `'destroyed'` along with {@link TurboCacheWorkerResource}: the
 * rule exists only to support the self-hosted cache, and Vercel Remote
 * Cache doesn't need it. The class stays in the registry so the
 * deploy's `'destroyed'`-resource phase can idempotently clean up the
 * rule via `destroy()` and so `routineStatus` can be flipped back to
 * `'created'` when re-enabling the self-hosted stack.
 */
export class TurboCacheWafBotSkipRuleResource extends ResourceBase {
  readonly id = 'turbo-cache-waf-bot-skip-rule';
  override readonly routineStatus: ResourceRoutineStatus = 'destroyed';

  async provision(_platform: CiPlatform, ctx: InfraContext): Promise<void> {
    assert.ok(
      !!ctx.zoneId,
      'turbo-cache-waf-bot-skip-rule: ctx.zoneId must be set by ZoneResource'
    );
    const headers = cfHeaders();
    const zoneId = ctx.zoneId;
    const host = turboCacheHost();

    const desiredRule = {
      action: 'skip',
      action_parameters: {
        ruleset: 'current',
        phases: ['http_request_sbfm'],
        products: [
          'bic',
          'hot',
          'rateLimit',
          'securityLevel',
          'uaBlock',
          'waf',
          'zoneLockdown',
        ],
      },
      expression: `(http.host eq "${host}")`,
      description: RULE_DESCRIPTION,
      enabled: true,
    };

    const entry = await fetchEntrypoint(zoneId, headers);

    if (entry === null) {
      const create = await fetch(`${CF_API}/zones/${zoneId}/rulesets`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'gamezilla zone custom WAF',
          description: 'Managed by @libs/infra',
          kind: 'zone',
          phase: PHASE,
          rules: [desiredRule],
        }),
      });
      assert.ok(
        create.ok,
        `WAF skip rule create failed: HTTP ${create.status} ${await create.text().catch(() => '')}`
      );
      ok('WAF bot skip', `${host} (ruleset + rule created)`);
      return;
    }

    const existing = (entry.rules ?? []).find(
      (r) => r.description === RULE_DESCRIPTION
    );

    if (existing) {
      ok('WAF bot skip', `${host} (exists)`);
      return;
    }

    const addRule = await fetch(
      `${CF_API}/zones/${zoneId}/rulesets/${entry.id}/rules`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(desiredRule),
      }
    );
    assert.ok(
      addRule.ok,
      `WAF skip rule add failed: HTTP ${addRule.status} ${await addRule.text().catch(() => '')}`
    );
    ok('WAF bot skip', `${host} (rule appended)`);
  }

  /** Idempotent: looks up the zone, finds the rule by description, deletes
   * it. 404s and missing zones / rules log as info and exit cleanly. */
  async destroy(_platform: CiPlatform): Promise<void> {
    const headers = cfHeaders();
    const zoneId = await findZoneId(headers);
    if (!zoneId) {
      info('WAF bot skip', 'zone not found — nothing to delete');
      return;
    }

    const entry = await fetchEntrypoint(zoneId, headers);
    if (entry === null) {
      info('WAF bot skip', 'custom WAF ruleset not found — nothing to delete');
      return;
    }

    const mine = (entry.rules ?? []).find(
      (r) => r.description === RULE_DESCRIPTION
    );
    if (!mine) {
      info('WAF bot skip', 'no managed rule found');
      return;
    }

    const del = await fetch(
      `${CF_API}/zones/${zoneId}/rulesets/${entry.id}/rules/${mine.id}`,
      {
        method: 'DELETE',
        headers,
      }
    );
    if (del.ok || del.status === 404) {
      ok('WAF bot skip', 'rule deleted');
    } else {
      warn('WAF bot skip delete', `HTTP ${del.status}`);
    }
  }
}

async function fetchEntrypoint(
  zoneId: string,
  headers: Record<string, string>
): Promise<Ruleset | null> {
  const res = await fetch(
    `${CF_API}/zones/${zoneId}/rulesets/phases/${PHASE}/entrypoint`,
    { headers }
  );
  if (res.status === 404) return null;
  if (res.status === 403) {
    assert.ok(
      false,
      'WAF entrypoint fetch returned HTTP 403. The CLOUDFLARE_API_TOKEN is ' +
        'missing the "Zone WAF: Edit" zone permission. Edit the token at ' +
        'https://dash.cloudflare.com/profile/api-tokens and add it, then rerun.'
    );
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    assert.ok(false, `WAF entrypoint fetch failed: HTTP ${res.status} ${body}`);
  }
  const body = (await res.json()) as { result?: Ruleset };
  return body.result ?? null;
}

async function findZoneId(
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
  return body.result?.find((z) => z.name === PROJECT_CONFIG.domain)?.id ?? null;
}
