import { SecretString, type SecretStore } from '@pkgs/secret-store';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { describe, expect, it, mock } from 'bun:test';
import Stripe from 'stripe';
import { StripeSecretKeys } from './secret-keys';
import { createStripeWebhookRoutes } from './stripe-webhook-route';

function makeRunResult(changes = 1) {
  return { changes, lastInsertRowid: 0 };
}

function makeSqlMock(
  run: SqlClient['run'] = async () => makeRunResult()
): SqlClient {
  return {
    query: async () => [],
    run,
    transaction: async (fn: (tx: SqlClient) => Promise<unknown>) =>
      fn(makeSqlMock(run)),
    disconnect: async () => {},
  } as unknown as SqlClient;
}

/**
 * Stripe's runtime constructor for `StripeSignatureVerificationError` takes
 * `(header, payload, raw)` but the published `.d.ts` only exposes the
 * single-arg `StripeError` constructor inherited from the base class. Cast
 * through `unknown` to call the real ctor without the deprecated single-arg
 * shape leaking the rejection's `instanceof` check.
 */
function makeStripeSigError(): Error {
  const Ctor = Stripe.errors
    .StripeSignatureVerificationError as unknown as new (
    header: string,
    payload: string,
    raw: { message?: string }
  ) => Error;
  return new Ctor('t=1,v1=fake', '{}', { message: 'No signatures found' });
}

describe('createStripeWebhookRoutes', () => {
  it('returns 503 when Stripe client is not configured', async () => {
    const sql = makeSqlMock();
    const secretStore = {
      getRequired: async (name: string) => new SecretString(name, ''),
      getOptional: async (name: string) => new SecretString(name, 'whsec_test'),
      getRequiredMany: async () => ({}),
    } as unknown as SecretStore;

    const app = createStripeWebhookRoutes({
      secretStore,
      stripe: null,
      getSqlClient: () => sql,
      webhookSecretKey: StripeSecretKeys.webhookSecret,
    });

    const res = await app.request('/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 't=1,v1=abc' },
      body: '{}',
    });
    expect(res.status).toBe(503);
  });

  it('returns 503 when webhook secret is missing', async () => {
    const sql = makeSqlMock();
    const secretStore = {
      getRequired: async (name: string) => new SecretString(name, ''),
      getOptional: async () => null,
      getRequiredMany: async () => ({}),
    } as unknown as SecretStore;

    const stripe = new Stripe('sk_test_dummy', {
      httpClient: Stripe.createFetchHttpClient(),
    });

    const app = createStripeWebhookRoutes({
      secretStore,
      stripe,
      getSqlClient: () => sql,
      webhookSecretKey: StripeSecretKeys.webhookSecret,
    });

    const res = await app.request('/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 't=1,v1=abc' },
      body: '{}',
    });
    expect(res.status).toBe(503);
  });

  it('refetches the signing secret with force=true after a signature verification failure and retries', async () => {
    const sql = makeSqlMock();

    const calls: { name: string; force: boolean }[] = [];
    const secretStore = {
      getRequired: async (name: string) => new SecretString(name, ''),
      getOptional: async (
        name: string,
        init?: { force?: boolean }
      ): Promise<SecretString | null> => {
        const force = init?.force === true;
        calls.push({ name, force });
        return new SecretString(name, force ? 'whsec_new' : 'whsec_old');
      },
      getRequiredMany: async () => ({}),
    } as unknown as SecretStore;

    const event = {
      id: 'evt_test_refresh',
      object: 'event',
      type: 'customer.created',
      data: { object: { id: 'cus_test_refresh', object: 'customer' } },
      livemode: false,
      api_version: '2024-11-20.acacia',
      created: 1_700_000_000,
    } as unknown as Stripe.Event;

    const construct = mock((_raw: string, _sig: string, secret: string) => {
      if (secret === 'whsec_new') return Promise.resolve(event);
      return Promise.reject(makeStripeSigError());
    });

    const stripe = {
      webhooks: {
        constructEventAsync: construct,
      },
      errors: Stripe.errors,
    } as unknown as Stripe;

    const app = createStripeWebhookRoutes({
      secretStore,
      stripe,
      getSqlClient: () => sql,
      webhookSecretKey: StripeSecretKeys.webhookSecret,
    });

    const res = await app.request('/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 't=1,v1=fake' },
      body: '{"x":1}',
    });

    expect(res.status).toBe(200);
    expect(construct.mock.calls.length).toBe(2);
    expect(calls).toEqual([
      { name: StripeSecretKeys.webhookSecret, force: false },
      { name: StripeSecretKeys.webhookSecret, force: true },
    ]);
  });

  it('returns 400 when the rotated signing secret still fails to verify', async () => {
    const sql = makeSqlMock();

    const calls: { force: boolean }[] = [];
    const secretStore = {
      getRequired: async (name: string) => new SecretString(name, ''),
      getOptional: async (
        name: string,
        init?: { force?: boolean }
      ): Promise<SecretString | null> => {
        calls.push({ force: init?.force === true });
        return new SecretString(name, 'whsec_stable');
      },
      getRequiredMany: async () => ({}),
    } as unknown as SecretStore;

    const construct = mock(() => Promise.reject(makeStripeSigError()));

    const stripe = {
      webhooks: { constructEventAsync: construct },
      errors: Stripe.errors,
    } as unknown as Stripe;

    const app = createStripeWebhookRoutes({
      secretStore,
      stripe,
      getSqlClient: () => sql,
      webhookSecretKey: StripeSecretKeys.webhookSecret,
    });

    const res = await app.request('/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 't=1,v1=fake' },
      body: '{}',
    });

    expect(res.status).toBe(400);
    expect(construct.mock.calls.length).toBe(1);
    expect(calls).toEqual([{ force: false }, { force: true }]);
  });

  it('writes verified event to entity_store (event cache + no webhook_event without account)', async () => {
    const runCalls: { sql: string; params: unknown[] }[] = [];
    const sql = makeSqlMock(
      async (sqlText: string, params: readonly unknown[] = []) => {
        runCalls.push({ sql: sqlText, params: [...params] });
        return makeRunResult();
      }
    );

    const secretStore = {
      getRequired: async (name: string) => new SecretString(name, ''),
      getOptional: async (name: string) => new SecretString(name, 'whsec_test'),
      getRequiredMany: async () => ({}),
    } as unknown as SecretStore;

    const event = {
      id: 'evt_test_1',
      object: 'event',
      type: 'customer.created',
      data: { object: { id: 'cus_test_1', object: 'customer' } },
      livemode: false,
      api_version: '2024-11-20.acacia',
      created: 1_700_000_000,
    } as unknown as Stripe.Event;

    const construct = mock((_raw: string, _sig: string) =>
      Promise.resolve(event)
    );

    const stripe = {
      webhooks: {
        constructEventAsync: construct,
      },
    } as unknown as Stripe;

    const app = createStripeWebhookRoutes({
      secretStore,
      stripe,
      getSqlClient: () => sql,
      webhookSecretKey: StripeSecretKeys.webhookSecret,
    });

    const res = await app.request('/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 't=1,v1=fake' },
      body: '{"x":1}',
    });

    expect(res.status).toBe(200);
    expect(construct.mock.calls.length).toBeGreaterThan(0);
    expect(runCalls.length).toBeGreaterThan(0);
    expect(runCalls[0]!.sql).toContain('entity_store');
    expect(runCalls[0]!.params.some((p) => p === 'webhook-event-cache')).toBe(
      true
    );
  });
});
