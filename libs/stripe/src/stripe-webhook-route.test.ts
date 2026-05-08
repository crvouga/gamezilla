import type { SecretStore } from '@gamezilla/lib/secret-store';
import type { PatchDb, PatchInput } from '@gamezilla/patch-db/interface';
import { describe, expect, it, mock } from 'bun:test';
import Stripe from 'stripe';
import { StripeSecretKeys } from './secret-keys';
import { createStripeWebhookRoutes } from './stripe-webhook-route';

describe('createStripeWebhookRoutes', () => {
  it('returns 503 when Stripe client is not configured', async () => {
    const patchDb = {
      write: async () => [],
    } as unknown as PatchDb;
    const secretStore = {
      getRequired: async () => '',
      getOptional: async () => 'whsec_test',
      getRequiredMany: async () => ({}),
    } as unknown as SecretStore;

    const app = createStripeWebhookRoutes({
      secretStore,
      stripe: null,
      patchDb,
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
    const patchDb = {
      write: async () => [],
    } as unknown as PatchDb;
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
      patchDb,
      webhookSecretKey: StripeSecretKeys.webhookSecret,
    });

    const res = await app.request('/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 't=1,v1=abc' },
      body: '{}',
    });
    expect(res.status).toBe(503);
  });

  it('writes verified event to patch-db (event cache + no webhook_event without account)', async () => {
    const writeCalls: { patches: PatchInput[] }[] = [];
    const patchDb = {
      write: async (patches: PatchInput[]) => {
        writeCalls.push({ patches });
        return [];
      },
    } as unknown as PatchDb;

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
      patchDb,
      webhookSecretKey: StripeSecretKeys.webhookSecret,
    });

    const res = await app.request('/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 't=1,v1=fake' },
      body: '{"x":1}',
    });

    expect(res.status).toBe(200);
    expect(construct.mock.calls.length).toBeGreaterThan(0);
    expect(writeCalls.length).toBe(1);
    const patches = writeCalls[0]!.patches;
    expect(patches.length).toBe(1);
    const p = patches[0]!;
    expect(p.entityType).toBe('stripe.customer.created');
    expect(p.entityId).toBe('cus_test_1');
    expect(p.attributes['stripe/payload']).toEqual(event);
    expect(p.attributes['stripe/object-type']).toBe('event');
  });
});
