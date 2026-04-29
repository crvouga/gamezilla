import { createEntityDbInMemory } from '@gamezilla/lib/entity-db/factory';
import type { SecretStore } from '@gamezilla/lib/secret-store';
import { describe, expect, it, mock } from 'bun:test';
import Stripe from 'stripe';
import { StripeSecretKeys } from './secret-keys';
import { createStripeWebhookRoutes } from './stripe-webhook-route';
import { stripeWebhookCompareVersions } from './webhook-cache-entity-db';

describe('createStripeWebhookRoutes', () => {
  it('returns 503 when Stripe client is not configured', async () => {
    const stripeCache = createEntityDbInMemory(stripeWebhookCompareVersions);
    const secretStore = {
      getRequired: async () => '',
      getOptional: async () => 'whsec_test',
      getRequiredMany: async () => ({}),
    } as unknown as SecretStore;

    const app = createStripeWebhookRoutes({
      secretStore,
      stripe: null,
      stripeCache,
      webhookSecretDopplerKey: StripeSecretKeys.webhookSecret,
    });

    const res = await app.request('/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 't=1,v1=abc' },
      body: '{}',
    });
    expect(res.status).toBe(503);
  });

  it('returns 503 when webhook secret is missing', async () => {
    const stripeCache = createEntityDbInMemory(stripeWebhookCompareVersions);
    const secretStore = {
      getRequired: async () => '',
      getOptional: async () => null,
      getRequiredMany: async () => ({}),
    } as unknown as SecretStore;

    const stripe = new Stripe('sk_test_dummy', {
      httpClient: Stripe.createFetchHttpClient(),
    });

    const app = createStripeWebhookRoutes({
      secretStore,
      stripe,
      stripeCache,
      webhookSecretDopplerKey: StripeSecretKeys.webhookSecret,
    });

    const res = await app.request('/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 't=1,v1=abc' },
      body: '{}',
    });
    expect(res.status).toBe(503);
  });

  it('upserts stripe cache on verified event', async () => {
    const stripeCache = createEntityDbInMemory(stripeWebhookCompareVersions);
    const secretStore = {
      getRequired: async () => '',
      getOptional: async () => 'whsec_test',
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
      stripeCache,
      webhookSecretDopplerKey: StripeSecretKeys.webhookSecret,
    });

    const res = await app.request('/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 't=1,v1=fake' },
      body: '{"x":1}',
    });

    expect(res.status).toBe(200);
    expect(construct.mock.calls.length).toBeGreaterThan(0);

    const row = await stripeCache.get({
      namespace: 'stripe',
      type: 'customer.created',
      id: 'cus_test_1',
    });
    expect(row).not.toBeNull();
    expect(row?.data).toEqual(event.data.object);
    expect(row?.metadata).toMatchObject({ event_id: 'evt_test_1' });
  });
});
