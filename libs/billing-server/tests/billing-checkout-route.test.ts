import { describe, expect, it } from 'bun:test';
import { BillingCheckoutRoutes } from '@libs/billing-server/billing-checkout-route';
import type { BillingRouteDeps } from '@libs/billing-shared/billing-route-deps';
import type {
  CallbackResult,
  MembershipBilling,
  OpenPortalInput,
  ReadCallbackInput,
  StartCheckoutInput,
  StartCheckoutResult,
} from '@pkgs/billing-root-shared/membership';
import { createMembershipProviders } from '@pkgs/billing-root-shared/providers';
import { createNoopLogger } from '@pkgs/logger-shared/logger';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';

const NOW = 1_700_000_000_000;

type FakeRow = Record<string, unknown>;

/** Minimal second provider; asserts the port is all the route depends on. */
class StubBilling implements MembershipBilling {
  cancelMembership(): Promise<void> {
    return Promise.reject(new Error('cancellation is outside this fixture'));
  }
  readPayments() {
    return Promise.resolve([]);
  }
  refundPayment(): Promise<void> {
    return Promise.reject(new Error('refund is outside this fixture'));
  }
  readonly provider = 'stub';
  readonly calls: StartCheckoutInput[] = [];

  constructor(private readonly url: string) {}

  startCheckout(input: StartCheckoutInput): Promise<StartCheckoutResult> {
    this.calls.push(input);
    return Promise.resolve({
      customerId: input.customerId ?? 'cus_new',
      url: this.url,
    });
  }

  openPortal(_input: OpenPortalInput): Promise<{ readonly url: string }> {
    return Promise.resolve({ url: 'https://portal.test' });
  }

  readCallback(_input: ReadCallbackInput): Promise<CallbackResult> {
    return Promise.resolve({ kind: 'unverified' });
  }
}

function fakeSql(linkedCustomerId: string | null = null): SqlClient {
  const sql = {
    query: async (query: {
      readonly sql: string;
    }): Promise<readonly FakeRow[]> => {
      const text = query.sql.trim();
      if (text.startsWith('SELECT user_id')) return [{ user_id: 'acc_1' }];
      if (text.startsWith('SELECT external_id')) {
        return linkedCustomerId === null
          ? []
          : [{ external_id: linkedCustomerId }];
      }
      return [];
    },
    run: async () => ({ changes: 1 }),
    transaction: async (fn: (tx: SqlClient) => Promise<unknown>) =>
      fn(sql as unknown as SqlClient),
    disconnect: async () => {},
  } as unknown as SqlClient;
  return sql;
}
function providersOf(adapter: MembershipBilling) {
  return createMembershipProviders({
    all: [adapter],
    checkout: adapter.provider,
  });
}

function deps(
  overrides: Partial<Omit<BillingRouteDeps, 'billing'>> & {
    readonly billing?: MembershipBilling | null;
  } = {}
): BillingRouteDeps {
  const { billing: adapter, ...rest } = overrides;
  return {
    getSqlClient: () => fakeSql(),
    requireAuth: () =>
      Promise.resolve({ accountId: 'acc_1', deviceId: 'dev_1' }),
    createId: (() => 'id-1') as never,
    clock: { now: () => NOW },
    log: createNoopLogger(),
    notifyUser: () => Promise.resolve(),
    ...rest,
    billing:
      adapter === null || adapter === undefined ? null : providersOf(adapter),
  };
}

const CHECKOUT_BODY = { returnUrl: 'https://example.com/return' };

describe('BillingCheckoutRoutes', () => {
  it('returns 503 when billing is not configured', async () => {
    const app = new BillingCheckoutRoutes(deps()).build();
    const res = await app.request('/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(CHECKOUT_BODY),
    });
    expect(res.status).toBe(503);
  });

  it('rejects a body without a valid return url', async () => {
    const app = new BillingCheckoutRoutes(
      deps({ billing: new StubBilling('https://pay.test/cs_1') })
    ).build();
    const res = await app.request('/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnUrl: 'not-a-url' }),
    });
    expect(res.status).toBe(400);
  });

  it('creates a customer, links it and notifies the link', async () => {
    const billing = new StubBilling('https://pay.test/cs_1');
    const notified: Array<{ tables: readonly string[] }> = [];
    const app = new BillingCheckoutRoutes(
      deps({
        billing,
        getSqlClient: () => fakeSql(null),
        notifyUser: (_accountId, _label, tables) => {
          notified.push({ tables });
          return Promise.resolve();
        },
      })
    ).build();
    const res = await app.request('/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(CHECKOUT_BODY),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'https://pay.test/cs_1' });
    expect(billing.calls[0]).toEqual({
      accountId: 'acc_1',
      customerId: null,
      email: null,
      returnUrl: 'https://example.com/return',
    });
    expect(notified).toEqual([{ tables: ['auth_external_accounts'] }]);
  });

  it('reuses a linked customer without re-notifying', async () => {
    const billing = new StubBilling('https://pay.test/cs_1');
    const notified: string[] = [];
    const app = new BillingCheckoutRoutes(
      deps({
        billing,
        getSqlClient: () => fakeSql('cus_linked'),
        notifyUser: (accountId) => {
          notified.push(accountId);
          return Promise.resolve();
        },
      })
    ).build();
    const res = await app.request('/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(CHECKOUT_BODY),
    });
    expect(res.status).toBe(200);
    expect(billing.calls[0]?.customerId).toBe('cus_linked');
    expect(notified).toEqual([]);
  });

  it('returns 502 when the provider hands back no url', async () => {
    const app = new BillingCheckoutRoutes(
      deps({
        billing: new StubBilling(''),
        getSqlClient: () => fakeSql('cus_1'),
      })
    ).build();
    const res = await app.request('/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(CHECKOUT_BODY),
    });
    expect(res.status).toBe(502);
  });
});
