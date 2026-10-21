/**
 * The billing routes over every combination the app can hit them with:
 * provider configured or not × caller (anonymous, signed in with no customer,
 * signed in with a linked customer) × what the provider answers. Each case
 * pins the HTTP status and every side effect — provider calls, customer
 * links, projection writes and sync pushes.
 */
import { describe, expect, test } from 'bun:test';
import { BillingApp } from '@libs/billing-server/billing-app';
import type {
  CallbackResult,
  MembershipBilling,
  MembershipChange,
} from '@pkgs/billing-root-shared/membership';
import { createMembershipProviders } from '@pkgs/billing-root-shared/providers';
import { createNoopLogger } from '@pkgs/logger-shared/logger';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import { Hono } from 'hono';

const NOW = 1_800_000_000_000;
const RETURN = { returnUrl: 'https://app.test/more/billing' };

type Caller = 'anonymous' | 'no_customer' | 'customer';
type SessionAnswer = 'ok' | 'empty_url' | 'throws';
type CallbackAnswer =
  | 'unverified'
  | 'ignored'
  | 'membership_linked'
  | 'membership_unlinked'
  | 'throws';

class Denied extends Error {}

type World = {
  readonly links: Map<string, string>; // customerId → accountId
  readonly runs: string[];
  readonly providerCalls: string[];
  readonly notified: string[];
};

function openWorld(caller: Caller): World {
  const links = new Map<string, string>();
  if (caller === 'customer') links.set('cus_linked', 'acc_1');
  return { links, runs: [], providerCalls: [], notified: [] };
}

/** What an outbox insert is for: the projection's telemetry or its re-check. */
function outboxRun(query: {
  readonly sql: string;
  readonly values: unknown[];
}): string {
  if (!query.sql.includes('INSERT INTO outbox_events')) return 'other';
  return String(query.values[0]).startsWith('billing-recheck:')
    ? 'recheck:scheduled'
    : 'telemetry:subscription';
}

function worldSql(world: World): SqlClient {
  const sql = {
    query: (query: { readonly sql: string; readonly values: unknown[] }) => {
      const text = query.sql.trim();
      if (text.startsWith('SELECT external_id')) {
        const [userId] = query.values;
        const hit = [...world.links].find(([, owner]) => owner === userId);
        return Promise.resolve(
          hit === undefined ? [] : [{ external_id: hit[0] }]
        );
      }
      if (text.startsWith('SELECT user_id')) {
        const owner = world.links.get(String(query.values[1]));
        return Promise.resolve(owner === undefined ? [] : [{ user_id: owner }]);
      }
      return Promise.resolve([]);
    },
    run: (query: { readonly sql: string; readonly values: unknown[] }) => {
      const text = query.sql.trim();
      if (text.startsWith('INSERT INTO auth_external_accounts')) {
        world.links.set(String(query.values[5]), String(query.values[3]));
        world.runs.push('link');
      } else if (text.startsWith('INSERT INTO billing_subscriptions')) {
        world.runs.push(`project:${String(query.values[8])}`);
      } else {
        world.runs.push(outboxRun(query));
      }
      return Promise.resolve({ changes: 1 });
    },
    transaction: (fn: (tx: SqlClient) => Promise<unknown>) =>
      fn(sql as unknown as SqlClient),
    disconnect: () => Promise.resolve(),
  } as unknown as SqlClient;
  return sql;
}

const CHANGE = (customerId: string): MembershipChange => ({
  provider: 'stub',
  customerId,
  subscriptionId: 'sub_1',
  offerPriceKey: 'subscription_monthly',
  membership: {
    status: 'active',
    periodEndMs: NOW + 1000,
    endsAtPeriodEnd: false,
  },
});

function stubBilling(
  world: World,
  session: SessionAnswer,
  callback: CallbackAnswer
): MembershipBilling {
  const answer = <T>(value: T): Promise<T> =>
    session === 'throws'
      ? Promise.reject(new Error('provider down'))
      : Promise.resolve(value);
  return {
    provider: 'stub',
    cancelMembership: () =>
      Promise.reject(new Error('cancellation is outside this fixture')),
    readPayments: () => Promise.resolve([]),
    refundPayment: () =>
      Promise.reject(new Error('refund is outside this fixture')),
    startCheckout: (input) => {
      world.providerCalls.push(`checkout:${String(input.customerId)}`);
      return answer({
        kind: 'checkout' as const,
        customerId: input.customerId ?? 'cus_new',
        url: session === 'empty_url' ? '' : 'https://pay.test/cs_1',
      });
    },
    openPortal: (input) => {
      world.providerCalls.push(`portal:${input.customerId}`);
      return answer({
        url: session === 'empty_url' ? '' : 'https://pay.test/p_1',
      });
    },
    readMembership: () => Promise.resolve(null),
    readCallback: () => {
      world.providerCalls.push('callback');
      const results: Record<
        Exclude<CallbackAnswer, 'throws'>,
        CallbackResult
      > = {
        unverified: { kind: 'unverified' },
        ignored: { kind: 'ignored' },
        membership_linked: { kind: 'membership', ...CHANGE('cus_linked') },
        membership_unlinked: { kind: 'membership', ...CHANGE('cus_stranger') },
      };
      return callback === 'throws'
        ? Promise.reject(new Error('provider down'))
        : Promise.resolve(results[callback]);
    },
  };
}

function appFor(
  world: World,
  caller: Caller,
  billing: MembershipBilling | null
): Hono {
  const inner = new BillingApp({
    getSqlClient: () => worldSql(world),
    billing:
      billing === null
        ? null
        : createMembershipProviders({
            all: [billing],
            checkout: billing.provider,
          }),
    requireAuth: () =>
      caller === 'anonymous'
        ? Promise.reject(new Denied('Permission denied: billing:manage'))
        : Promise.resolve({ accountId: 'acc_1', deviceId: 'dev_1' }),
    createId: (() => 'id-1') as never,
    clock: { now: () => NOW },
    log: createNoopLogger(),
    notifyUser: (accountId, _label, tables) => {
      world.notified.push(`${accountId}:${tables.join(',')}`);
      return Promise.resolve();
    },
  }).build();
  // The API's error handler maps an auth denial to 401 and anything else to 500.
  return new Hono()
    .route('/', inner)
    .onError((error, c) =>
      c.json({ error: error.message }, error instanceof Denied ? 401 : 500)
    );
}

type Outcome = {
  readonly status: number;
  readonly providerCalls: readonly string[];
  readonly runs: readonly string[];
  readonly notified: readonly string[];
};

type Scenario = {
  readonly route: 'checkout' | 'portal' | 'callback';
  readonly configured: boolean;
  readonly caller: Caller;
  readonly session: SessionAnswer;
  readonly callback: CallbackAnswer;
};

async function run(scenario: Scenario): Promise<Outcome> {
  const { route, configured, caller, session, callback } = scenario;
  const world = openWorld(caller);
  const billing = configured ? stubBilling(world, session, callback) : null;
  const res = await appFor(world, caller, billing).request(
    route === 'callback' ? '/billing/callback/stub' : `/billing/${route}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(route === 'callback' ? { id: 'evt_1' } : RETURN),
    }
  );
  return {
    status: res.status,
    providerCalls: world.providerCalls,
    runs: world.runs,
    notified: world.notified,
  };
}

const CALLERS: readonly Caller[] = ['anonymous', 'no_customer', 'customer'];
const SESSIONS: readonly SessionAnswer[] = ['ok', 'empty_url', 'throws'];
const CALLBACKS: readonly CallbackAnswer[] = [
  'unverified',
  'ignored',
  'membership_linked',
  'membership_unlinked',
  'throws',
];

const NONE: Omit<Outcome, 'status'> = {
  providerCalls: [],
  runs: [],
  notified: [],
};

function expectedCheckout(caller: Caller, session: SessionAnswer): Outcome {
  if (caller === 'anonymous') return { status: 401, ...NONE };
  const customer = caller === 'customer' ? 'cus_linked' : 'null';
  const providerCalls = [`checkout:${customer}`];
  // An outage is a plain 503 the app can explain, never a bare 500.
  if (session === 'throws') return { status: 503, ...NONE, providerCalls };
  // A new customer is linked (and pushed) even when the provider sent no url.
  const linked = caller === 'no_customer';
  return {
    status: session === 'ok' ? 200 : 502,
    providerCalls,
    runs: linked ? ['link'] : [],
    notified: linked ? ['acc_1:auth_external_accounts'] : [],
  };
}

function expectedPortal(caller: Caller, session: SessionAnswer): Outcome {
  if (caller === 'anonymous') return { status: 401, ...NONE };
  if (caller === 'no_customer') return { status: 404, ...NONE };
  const providerCalls = ['portal:cus_linked'];
  // An outage is a plain 503 the app can explain, never a bare 500.
  if (session === 'throws') return { status: 503, ...NONE, providerCalls };
  return { status: session === 'ok' ? 200 : 502, ...NONE, providerCalls };
}

function expectedCallback(caller: Caller, callback: CallbackAnswer): Outcome {
  const providerCalls = ['callback'];
  if (callback === 'throws') return { status: 500, ...NONE, providerCalls };
  if (callback === 'unverified') return { status: 400, ...NONE, providerCalls };
  // Callbacks carry no session: the caller only matters through the link.
  const projects = callback === 'membership_linked' && caller === 'customer';
  return {
    status: 200,
    providerCalls,
    runs: projects
      ? ['project:active', 'telemetry:subscription', 'recheck:scheduled']
      : [],
    notified: projects ? ['acc_1:billing_subscriptions'] : [],
  };
}

describe('billing routes, every combination', () => {
  test('unconfigured billing answers 503 and touches nothing', async () => {
    for (const route of ['checkout', 'portal', 'callback'] as const) {
      for (const caller of CALLERS) {
        expect({
          route,
          caller,
          outcome: await run({
            route,
            configured: false,
            caller,
            session: 'ok',
            callback: 'ignored',
          }),
        }).toEqual({
          route,
          caller,
          outcome: { status: 503, ...NONE },
        });
      }
    }
  });

  test('checkout: caller × provider answer', async () => {
    for (const caller of CALLERS) {
      for (const session of SESSIONS) {
        expect({
          caller,
          session,
          outcome: await run({
            route: 'checkout',
            configured: true,
            caller,
            session,
            callback: 'ignored',
          }),
        }).toEqual({
          caller,
          session,
          outcome: expectedCheckout(caller, session),
        });
      }
    }
  });

  test('portal: caller × provider answer', async () => {
    for (const caller of CALLERS) {
      for (const session of SESSIONS) {
        expect({
          caller,
          session,
          outcome: await run({
            route: 'portal',
            configured: true,
            caller,
            session,
            callback: 'ignored',
          }),
        }).toEqual({
          caller,
          session,
          outcome: expectedPortal(caller, session),
        });
      }
    }
  });

  test('callback: link state × provider answer', async () => {
    for (const caller of CALLERS) {
      for (const callback of CALLBACKS) {
        expect({
          caller,
          callback,
          outcome: await run({
            route: 'callback',
            configured: true,
            caller,
            session: 'ok',
            callback: callback,
          }),
        }).toEqual({
          caller,
          callback,
          outcome: expectedCallback(caller, callback),
        });
      }
    }
  });

  test('a bad return url is rejected before the provider is asked', async () => {
    for (const route of ['checkout', 'portal'] as const) {
      for (const caller of CALLERS) {
        const world = openWorld(caller);
        const res = await appFor(
          world,
          caller,
          stubBilling(world, 'ok', 'ignored')
        ).request(`/billing/${route}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ returnUrl: 'not-a-url' }),
        });
        expect({
          route,
          caller,
          status: res.status,
          calls: world.providerCalls,
        }).toEqual({
          route,
          caller,
          status: 400,
          calls: [],
        });
      }
    }
  });
});
