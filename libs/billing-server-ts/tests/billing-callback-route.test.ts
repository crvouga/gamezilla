import { afterEach, describe, expect, it } from 'bun:test';
import { BillingCallbackRoutes } from '@libs/billing-server-ts/billing-callback-route';
import type { BillingRouteDeps } from '@libs/billing-shared-ts/billing-route-deps';
import { context, metrics, propagation, trace } from '@opentelemetry/api';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
} from '@opentelemetry/sdk-metrics';
import { InMemorySpanExporter } from '@opentelemetry/sdk-trace-base';
import type {
  CallbackResult,
  MembershipBilling,
  OpenPortalInput,
  ReadCallbackInput,
  StartCheckoutInput,
  StartCheckoutResult,
} from '@pkgs/billing-root-shared-ts/membership';
import { createMembershipProviders } from '@pkgs/billing-root-shared-ts/providers';
import { createNoopLogger } from '@pkgs/logger-shared-ts/logger';
import { createWorkerTelemetry } from '@pkgs/observability-root-server-ts/worker-worker';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';

const NOW = 1_700_000_000_000;

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
  constructor(private readonly result: CallbackResult) {}

  startCheckout(_input: StartCheckoutInput): Promise<StartCheckoutResult> {
    return Promise.resolve({
      kind: 'checkout',
      customerId: 'cus_new',
      url: 'https://pay.test',
    });
  }

  openPortal(_input: OpenPortalInput): Promise<{ readonly url: string }> {
    return Promise.resolve({ url: 'https://portal.test' });
  }

  readMembership(): Promise<null> {
    return Promise.resolve(null);
  }

  readCallback(_input: ReadCallbackInput): Promise<CallbackResult> {
    return Promise.resolve(this.result);
  }
}

type Captured = {
  readonly statements: string[];
  readonly values: readonly unknown[];
};

function fakeSql(
  ownerId: string | null,
  captured: Captured = { statements: [], values: [] }
): SqlClient {
  const sql = {
    query: async (query: { readonly sql: string }) => {
      if (query.sql.includes('SELECT user_id')) {
        return ownerId === null ? [] : [{ user_id: ownerId }];
      }
      return [];
    },
    run: async (query: {
      readonly sql: string;
      readonly values: unknown[];
    }) => {
      (captured.statements as string[]).push(query.sql);
      (captured.values as unknown[]).push(...query.values);
      return { changes: 1 };
    },
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
  result: CallbackResult,
  ownerId: string | null,
  captured: Captured = { statements: [], values: [] },
  overrides: Partial<Omit<BillingRouteDeps, 'billing'>> & {
    readonly billing?: MembershipBilling | null;
  } = {}
): BillingRouteDeps {
  const { billing: adapter, ...rest } = overrides;
  return {
    getSqlClient: () => fakeSql(ownerId, captured),
    requireAuth: () =>
      Promise.resolve({ accountId: 'acc_1', deviceId: 'dev_1' }),
    createId: (() => 'id-1') as never,
    clock: { now: () => NOW },
    log: createNoopLogger(),
    notifyUser: () => Promise.resolve(),
    ...rest,
    billing:
      adapter === null ? null : providersOf(adapter ?? new StubBilling(result)),
  };
}

const CHANGE: CallbackResult = {
  kind: 'membership',
  provider: 'stub',
  customerId: 'cus_1',
  subscriptionId: 'sub_1',
  offerPriceKey: 'subscription_monthly',
  membership: {
    status: 'active',
    periodEndMs: NOW + 1000,
    endsAtPeriodEnd: true,
  },
};

function post(app: ReturnType<BillingCallbackRoutes['build']>) {
  return app.request('/billing/callback/stub', {
    method: 'POST',
    headers: { 'stub-signature': 'sig' },
    body: '{}',
  });
}

describe('BillingCallbackRoutes', () => {
  it('returns 503 when billing is not configured', async () => {
    const app = new BillingCallbackRoutes(
      deps(CHANGE, 'acc_1', undefined, { billing: null })
    ).build();
    expect((await post(app)).status).toBe(503);
  });

  it('rejects an unverified callback', async () => {
    const app = new BillingCallbackRoutes(
      deps({ kind: 'unverified' }, 'acc_1')
    ).build();
    const res = await post(app);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid callback signature' });
  });

  it('acknowledges an ignored callback without writing', async () => {
    const captured: Captured = { statements: [], values: [] };
    const app = new BillingCallbackRoutes(
      deps({ kind: 'ignored' }, 'acc_1', captured)
    ).build();
    const res = await post(app);
    expect(res.status).toBe(200);
    expect(captured.statements).toEqual([]);
  });

  it('does nothing when the provider customer is unlinked', async () => {
    const captured: Captured = { statements: [], values: [] };
    const notified: string[] = [];
    const app = new BillingCallbackRoutes(
      deps(CHANGE, null, captured, {
        notifyUser: (accountId) => {
          notified.push(accountId);
          return Promise.resolve();
        },
      })
    ).build();
    const res = await post(app);
    expect(res.status).toBe(200);
    expect(captured.statements).toEqual([]);
    expect(notified).toEqual([]);
  });

  it('projects a resolved change and notifies the owning account', async () => {
    const captured: Captured = { statements: [], values: [] };
    const notified: Array<{ accountId: string; tables: readonly string[] }> =
      [];
    const app = new BillingCallbackRoutes(
      deps(CHANGE, 'acc_1', captured, {
        notifyUser: (accountId, _label, tables) => {
          notified.push({ accountId, tables });
          return Promise.resolve();
        },
      })
    ).build();
    const res = await post(app);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(
      captured.statements.some((s) =>
        s.includes('INSERT INTO billing_subscriptions')
      )
    ).toBe(true);
    expect(captured.values).toContain('acc_1');
    expect(captured.values).toContain('stub:sub_1');
    expect(captured.values).toContain('subscription_monthly');
    expect(captured.values).toContain('active');
    expect(notified).toEqual([
      { accountId: 'acc_1', tables: ['billing_subscriptions'] },
    ]);
  });
});

describe('BillingCallbackRoutes outcomes', () => {
  afterEach(() => {
    metrics.disable();
    trace.disable();
    propagation.disable();
    context.disable();
  });

  // regression: billing-callback-rejections-uncounted
  it('counts refused and failed callbacks for the environment', async () => {
    const exporter = new InMemoryMetricExporter(
      AggregationTemporality.CUMULATIVE
    );
    const runtime = createWorkerTelemetry({
      serviceName: 'billing-callback-test',
      serviceVersion: '1',
      environment: 'staging',
      buildSha: 'abc',
      exporter: new InMemorySpanExporter(),
      metricExporter: exporter,
    });
    const refused = new BillingCallbackRoutes(
      deps({ kind: 'unverified' }, 'acc_1')
    ).build();
    expect((await post(refused)).status).toBe(400);
    expect((await post(refused)).status).toBe(400);
    const accepted = new BillingCallbackRoutes(deps(CHANGE, 'acc_1')).build();
    expect((await post(accepted)).status).toBe(200);
    const crossed = new BillingCallbackRoutes(
      deps({ ...CHANGE, provider: 'other' }, 'acc_1')
    ).build();
    expect((await post(crossed)).status).toBe(500);
    expect(
      (
        await refused.request('/billing/callback/unknown', {
          method: 'POST',
          body: '{}',
        })
      ).status
    ).toBe(404);

    await runtime.forceFlush();
    const points = exporter
      .getMetrics()
      .flatMap((r) => r.scopeMetrics.flatMap((m) => m.metrics))
      .find((m) => m.descriptor.name === 'billing.callbacks')
      ?.dataPoints.map((p) => [p.attributes['app.outcome'], p.value]);
    expect(Object.fromEntries(points ?? [])).toEqual({
      unverified: 2,
      accepted: 1,
      failed: 1,
      unknown_provider: 1,
    });
    expect(
      exporter
        .getMetrics()
        .flatMap((r) => r.scopeMetrics.flatMap((m) => m.metrics))
        .find((m) => m.descriptor.name === 'billing.callbacks')
        ?.dataPoints.every(
          (p) => p.attributes['deployment.environment.name'] === 'staging'
        )
    ).toBe(true);
    await runtime.shutdown();
  });
});
