import { describe, expect, it } from 'bun:test';
import type {
  CallbackResult,
  MembershipBilling,
  OpenPortalInput,
  ReadCallbackInput,
  StartCheckoutInput,
  StartCheckoutResult,
} from '@pkgs/billing';
import { createMembershipProviders } from '@pkgs/billing';
import { createNoopLogger } from '@pkgs/logger';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { BillingRouteDeps } from '../../../shared/routes/billing-route-deps';
import { BillingPortalRoutes } from './billing-portal-route';

const NOW = 1_700_000_000_000;

class StubBilling implements MembershipBilling {
  readonly provider = 'stub';
  constructor(private readonly url: string) {}

  startCheckout(_input: StartCheckoutInput): Promise<StartCheckoutResult> {
    return Promise.resolve({ customerId: 'cus_new', url: 'https://pay.test' });
  }

  openPortal(_input: OpenPortalInput): Promise<{ readonly url: string }> {
    return Promise.resolve({ url: this.url });
  }

  readCallback(_input: ReadCallbackInput): Promise<CallbackResult> {
    return Promise.resolve({ kind: 'unverified' });
  }
}

function fakeSql(externalId: string | null): SqlClient {
  const sql = {
    query: async (query: { readonly sql: string }) => {
      if (query.sql.includes('FROM auth_external_accounts')) {
        return externalId === null ? [] : [{ external_id: externalId }];
      }
      return [];
    },
    run: async () => ({ changes: 0 }),
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
  externalId: string | null,
  url: string | null = 'https://billing.test/portal/cus_1',
  overrides: Partial<Omit<BillingRouteDeps, 'billing'>> & {
    readonly billing?: MembershipBilling | null;
  } = {}
): BillingRouteDeps {
  const { billing: adapter, ...rest } = overrides;
  return {
    getSqlClient: () => fakeSql(externalId),
    requireAuth: () =>
      Promise.resolve({ accountId: 'acc_1', deviceId: 'dev_1' }),
    createId: (() => 'id-1') as never,
    clock: { now: () => NOW },
    log: createNoopLogger(),
    notifyUser: () => Promise.resolve(),
    ...rest,
    billing:
      adapter === null
        ? null
        : providersOf(adapter ?? new StubBilling(url ?? '')),
  };
}

const PORTAL_BODY = { returnUrl: 'https://example.com/return' };

describe('BillingPortalRoutes', () => {
  it('returns 503 when billing is not configured', async () => {
    const app = new BillingPortalRoutes(
      deps('cus_1', null, { billing: null })
    ).build();
    const res = await app.request('/billing/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(PORTAL_BODY),
    });
    expect(res.status).toBe(503);
  });

  it('returns the portal url for a linked customer', async () => {
    const app = new BillingPortalRoutes(deps('cus_1')).build();
    const res = await app.request('/billing/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(PORTAL_BODY),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      url: 'https://billing.test/portal/cus_1',
    });
  });

  it('returns 404 when the account has no billing customer', async () => {
    const app = new BillingPortalRoutes(deps(null)).build();
    const res = await app.request('/billing/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(PORTAL_BODY),
    });
    expect(res.status).toBe(404);
  });

  it('returns 502 when the provider hands back no url', async () => {
    const app = new BillingPortalRoutes(deps('cus_1', null)).build();
    const res = await app.request('/billing/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(PORTAL_BODY),
    });
    expect(res.status).toBe(502);
  });
});
