import { describe, expect, it } from 'bun:test';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { MOCK_BILLING_TEST_IDS } from '../../../public/mock-test-ids';
import { PLUS_MEMBERSHIP_OFFER } from '../../../shared/offer/plus-membership-offer';
import type { MockBillingState } from '../shared/mock-billing-contract';
import { BillingMockRoutes } from './billing-mock-routes';

const NOW = 1_700_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * DAY_MS;
const ACCOUNT = 'acc_1';

type Row = {
  provider: string;
  provider_subscription_id: string;
  price_key: string | null;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: number;
};

type Harness = {
  readonly app: ReturnType<BillingMockRoutes['build']>;
  readonly state: { row: Row | null; clockMs: number };
  readonly notified: Array<readonly string[]>;
};

/** Stateful SQL double: the mock reads back whatever it just wrote. */
function fakeSql(state: { row: Row | null; clockMs: number }): SqlClient {
  const sqlClient = {
    query: async (query: { readonly sql: string }) => {
      if (query.sql.includes('FROM billing_subscriptions')) {
        return state.row === null ? [] : [state.row];
      }
      return [];
    },
    run: async (query: {
      readonly sql: string;
      readonly values: unknown[];
    }) => {
      const v = query.values;
      state.row = {
        provider: String(v[5]),
        provider_subscription_id: String(v[6]),
        price_key: v[7] === null ? null : String(v[7]),
        status: String(v[8]),
        current_period_end: v[9] === null ? null : String(v[9]),
        cancel_at_period_end: Number(v[10]),
      };
      return { changes: 1 };
    },
    transaction: async (fn: (tx: SqlClient) => Promise<unknown>) =>
      fn(sqlClient as unknown as SqlClient),
    disconnect: async () => {},
  } as unknown as SqlClient;
  return sqlClient;
}

function harness(): Harness {
  const state: { row: Row | null; clockMs: number } = {
    row: null,
    clockMs: NOW,
  };
  const notified: Array<readonly string[]> = [];
  const app = new BillingMockRoutes({
    getSqlClient: () => fakeSql(state),
    offer: PLUS_MEMBERSHIP_OFFER,
    clock: { now: () => state.clockMs },
    createId: (() => 'id-1') as never,
    notifyUser: (_accountId, _label, tables) => {
      notified.push(tables);
      return Promise.resolve();
    },
  }).build();
  return { app, state, notified };
}

function postJson(
  app: Harness['app'],
  path: string,
  body: Record<string, unknown>,
  redirect: 'manual' | 'follow' = 'manual'
) {
  return app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    redirect,
  });
}

async function pay(
  harnessed: Harness,
  priceKey = 'subscription_monthly'
): Promise<Response> {
  return postJson(harnessed.app, '/billing/mock/api/checkout', {
    accountId: ACCOUNT,
    priceKey,
  });
}

async function portal(
  harnessed: Harness,
  action: Record<string, string>
): Promise<Response> {
  return postJson(harnessed.app, '/billing/mock/api/portal', {
    accountId: ACCOUNT,
    action,
  });
}

async function observe(harnessed: Harness, kind: string): Promise<Response> {
  return postJson(harnessed.app, '/billing/mock/observe', {
    accountId: ACCOUNT,
    kind,
  });
}

describe('BillingMockRoutes', () => {
  it('serves the SPA shell for both hosted pages', async () => {
    const { app } = harness();
    for (const page of ['checkout', 'portal']) {
      const res = await app.request(
        `/billing/mock/${page}?accountId=${ACCOUNT}&returnUrl=https%3A%2F%2Fapp.test`
      );
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      const html = await res.text();
      expect(html).toContain('id="mock-billing-root"');
      expect(html).toContain('src="assets/app.js"');
    }
  });

  it('serves the embedded SPA bundle', async () => {
    const { app } = harness();
    const js = await app.request('/billing/mock/assets/app.js');
    expect(js.status).toBe(200);
    expect(js.headers.get('content-type')).toContain('javascript');
    expect(await js.text()).toContain(MOCK_BILLING_TEST_IDS.checkoutPay);
    const css = await app.request('/billing/mock/assets/app.css');
    expect(css.headers.get('content-type')).toContain('text/css');
  });

  it('reports the offer and no membership before checkout', async () => {
    const { app } = harness();
    const res = await app.request(
      `/billing/mock/api/state?accountId=${ACCOUNT}`
    );
    expect(res.status).toBe(200);
    const state = (await res.json()) as MockBillingState;
    expect(state.membership).toBeNull();
    expect(state.nowMs).toBe(NOW);
    expect(state.prices.map((price) => price.key)).toEqual([
      'subscription_monthly',
      'subscription_yearly',
    ]);
  });

  it('pay writes a trialing membership with the default price', async () => {
    const harnessed = harness();
    const res = await pay(harnessed);
    expect(res.status).toBe(200);
    expect(harnessed.state.row?.status).toBe('trialing');
    expect(harnessed.state.row?.price_key).toBe('subscription_monthly');
    expect(Date.parse(harnessed.state.row?.current_period_end ?? '')).toBe(
      NOW + 7 * DAY_MS
    );
    expect(harnessed.notified).toEqual([['billing_subscriptions']]);
  });

  it('pay is a no-op while a live membership exists', async () => {
    const harnessed = harness();
    await pay(harnessed);
    harnessed.state.clockMs = NOW + DAY_MS;
    await pay(harnessed);
    expect(harnessed.state.row?.status).toBe('trialing');
    expect(Date.parse(harnessed.state.row?.current_period_end ?? '')).toBe(
      NOW + 7 * DAY_MS
    );
  });

  it('portal cancel sets cancel_at_period_end and resume clears it', async () => {
    const harnessed = harness();
    await pay(harnessed);
    await portal(harnessed, { kind: 'cancel' });
    expect(harnessed.state.row?.cancel_at_period_end).toBe(1);
    await portal(harnessed, { kind: 'resume' });
    expect(harnessed.state.row?.cancel_at_period_end).toBe(0);
  });

  it('portal switch flips the price key', async () => {
    const harnessed = harness();
    await pay(harnessed);
    const res = await portal(harnessed, {
      kind: 'switch',
      priceKey: 'subscription_yearly',
    });
    expect(res.status).toBe(200);
    const state = (await res.json()) as MockBillingState;
    expect(state.membership?.priceKey).toBe('subscription_yearly');
    expect(harnessed.state.row?.price_key).toBe('subscription_yearly');
    expect(harnessed.state.row?.status).toBe('active');
  });

  it('portal rejects an unknown price', async () => {
    const harnessed = harness();
    await pay(harnessed);
    const res = await portal(harnessed, { kind: 'switch', priceKey: 'nope' });
    expect(res.status).toBe(400);
  });

  it('checkout starts the chosen price', async () => {
    const harnessed = harness();
    await pay(harnessed, 'subscription_yearly');
    expect(harnessed.state.row?.price_key).toBe('subscription_yearly');
  });

  it('checkout rejects an unknown price', async () => {
    const harnessed = harness();
    expect((await pay(harnessed, 'nope')).status).toBe(400);
    expect(harnessed.state.row).toBeNull();
  });

  it('portal returns 404 when the account has no membership', async () => {
    const harnessed = harness();
    expect((await portal(harnessed, { kind: 'cancel' })).status).toBe(404);
  });

  it('returns 404 from observe when the account has no membership', async () => {
    const harnessed = harness();
    expect((await observe(harnessed, 'period_end')).status).toBe(404);
  });

  it('each observe kind produces the documented status', async () => {
    const cases: ReadonlyArray<
      readonly [string, { status: string; endsAtPeriodEnd: number }]
    > = [
      ['period_end', { status: 'active', endsAtPeriodEnd: 0 }],
      ['payment_failed', { status: 'delinquent', endsAtPeriodEnd: 0 }],
      ['payment_recovered', { status: 'active', endsAtPeriodEnd: 0 }],
      ['cancel_at_period_end', { status: 'trialing', endsAtPeriodEnd: 1 }],
      ['resume', { status: 'trialing', endsAtPeriodEnd: 0 }],
      ['cancel_now', { status: 'ended', endsAtPeriodEnd: 0 }],
      ['switch_interval', { status: 'active', endsAtPeriodEnd: 0 }],
      ['payment_incomplete', { status: 'incomplete', endsAtPeriodEnd: 0 }],
      ['payment_expired', { status: 'ended', endsAtPeriodEnd: 0 }],
    ];
    for (const [kind, expected] of cases) {
      const harnessed = harness();
      await pay(harnessed);
      const res = await observe(harnessed, kind);
      expect(res.status).toBe(200);
      expect(harnessed.state.row?.status).toBe(expected.status);
      expect(harnessed.state.row?.cancel_at_period_end).toBe(
        expected.endsAtPeriodEnd
      );
    }
  });

  it('period_end renews one interval forward', async () => {
    const harnessed = harness();
    await pay(harnessed);
    harnessed.state.clockMs = NOW + 7 * DAY_MS;
    await observe(harnessed, 'period_end');
    expect(harnessed.state.row?.status).toBe('active');
    expect(Date.parse(harnessed.state.row?.current_period_end ?? '')).toBe(
      NOW + 7 * DAY_MS + MONTH_MS
    );
  });

  it('switch_interval flips the price key to the other switchable price', async () => {
    const harnessed = harness();
    await pay(harnessed);
    await observe(harnessed, 'switch_interval');
    expect(harnessed.state.row?.price_key).toBe('subscription_yearly');
  });

  it('the same observe twice leaves identical state', async () => {
    const harnessed = harness();
    await pay(harnessed);
    await observe(harnessed, 'payment_failed');
    const before = harnessed.state.row;
    if (before === null) throw new Error('expected a membership row');
    const first: Row = { ...before };
    await observe(harnessed, 'payment_failed');
    expect(harnessed.state.row).toEqual(first);
  });
});
