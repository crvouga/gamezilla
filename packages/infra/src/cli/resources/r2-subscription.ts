import { info, ok } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import { cfAccountId } from '../secrets/cloudflare';
import { ResourceBase, type InfraContext } from './types';

const R2_NOT_ENABLED_CODE = 10042;

const R2_RATE_PLAN_IDS = [
  'r2_free',
  'r2_subscribers_free',
  'r2_basic',
] as const;

interface CfApiResponse {
  success: boolean;
  errors?: Array<{ code: number; message: string }>;
}

export class R2SubscriptionResource extends ResourceBase {
  readonly id = 'r2-subscription';

  async provision(platform: CiPlatform, _ctx: InfraContext): Promise<void> {
    const accountId = cfAccountId();
    const token = process.env['CLOUDFLARE_API_TOKEN'] ?? '';
    const status = await probeR2(accountId, token);

    if (status === 'enabled') {
      ok('R2', 'already enabled');
      return;
    }

    if (status !== 'not-enabled') {
      platform.warning(`R2 probe returned unexpected status: ${status}`);
      return;
    }

    info('R2', 'not enabled — activating subscription…');

    for (const planId of R2_RATE_PLAN_IDS) {
      const activated = await tryActivate(accountId, token, planId);
      if (activated) {
        ok('R2', `activated with rate plan "${planId}"`);
        return;
      }
    }

    throw new Error(
      [
        'Could not activate R2 via API.',
        'Please enable R2 manually (one-time, free):',
        '  https://dash.cloudflare.com → R2 in the sidebar → accept terms',
        'Then re-run the deploy.',
      ].join('\n')
    );
  }

  async destroy(): Promise<void> {
    ok('R2 subscription', 'cannot un-subscribe — skipping');
  }
}

async function probeR2(
  accountId: string,
  token: string
): Promise<'enabled' | 'not-enabled' | string> {
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets?per_page=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'cf-r2-jurisdiction': 'default',
        },
      }
    );

    if (res.ok) return 'enabled';

    const body = (await res.json()) as CfApiResponse;
    const notEnabled = body.errors?.some((e) => e.code === R2_NOT_ENABLED_CODE);
    if (notEnabled) return 'not-enabled';

    return `HTTP ${res.status}: ${body.errors?.[0]?.message ?? 'unknown'}`;
  } catch (e) {
    return `unreachable: ${e instanceof Error ? e.message : String(e)}`;
  }
}

async function tryActivate(
  accountId: string,
  token: string,
  ratePlanId: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/subscriptions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rate_plan: { id: ratePlanId },
        }),
      }
    );

    if (res.ok) return true;

    await res.arrayBuffer();
    return false;
  } catch {
    return false;
  }
}
