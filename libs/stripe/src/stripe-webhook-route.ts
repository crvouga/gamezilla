import { createLogger } from '@pkgs/logger';
import type { SecretStore } from '@pkgs/secret-store';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { Hono } from 'hono';
import Stripe from 'stripe';
import {
  stripeEventObjectId,
  stripeWebhookEventCacheEntityId,
} from './event-object-id';
import { resolveAccountIdByStripeCustomerId } from './resolve-account-by-stripe-customer';
import { upsertStripeEntityStoreRow } from './server/entity-store-sql';
import { StripeAttr, StripeEntityAttr } from './stripe-attrs';
import {
  STRIPE_WEBHOOK_EVENT_CACHE_ENTITY_TYPE,
  STRIPE_WEBHOOK_EVENT_ENTITY_TYPE,
} from './stripe-catalog-mirror';

const log = createLogger({ name: 'stripe:webhook' });

function customerIdFromString(c: unknown): string | null {
  return typeof c === 'string' && c.startsWith('cus_') ? c : null;
}

function customerIdFromObject(c: unknown): string | null {
  if (typeof c !== 'object' || c === null || !('id' in c)) {
    return null;
  }
  const id = (c as { id: unknown }).id;
  return typeof id === 'string' && id.startsWith('cus_') ? id : null;
}

function extractStripeCustomerId(event: Stripe.Event): string | null {
  const obj = event.data?.object as unknown;
  if (obj === null || typeof obj !== 'object') {
    return null;
  }
  const c = (obj as Record<string, unknown>)['customer'];
  return customerIdFromString(c) ?? customerIdFromObject(c);
}

async function recordVerifiedStripeWebhookInEntityStore(
  sql: SqlClient,
  event: Stripe.Event,
  objectId: string
): Promise<void> {
  const customerId = extractStripeCustomerId(event);
  let accountId: string | null = null;
  if (customerId !== null) {
    accountId = await resolveAccountIdByStripeCustomerId(sql, customerId);
  }

  const eventCacheData: Record<string, unknown> = {
    ...StripeAttr.payload(event as unknown),
    ...StripeAttr.objectType('event'),
    ...StripeAttr.source('stripe_webhook'),
    ...StripeAttr.webhookEventType(event.type),
    ...StripeAttr.stripeObjectId(objectId),
  };
  if (accountId !== null) {
    Object.assign(eventCacheData, StripeEntityAttr.owner(accountId));
  }

  await upsertStripeEntityStoreRow(sql, {
    patchEntityType: STRIPE_WEBHOOK_EVENT_CACHE_ENTITY_TYPE,
    externalId: stripeWebhookEventCacheEntityId(event.type, objectId),
    ownerId: accountId,
    data: eventCacheData,
  });

  if (accountId !== null) {
    await upsertStripeEntityStoreRow(sql, {
      patchEntityType: STRIPE_WEBHOOK_EVENT_ENTITY_TYPE,
      externalId: objectId,
      ownerId: accountId,
      data: {
        ...StripeEntityAttr.owner(accountId),
        ...StripeAttr.webhookEventType(event.type),
        ...StripeAttr.stripeObjectId(objectId),
      },
    });
  }
}

async function readWebhookSecret(
  secretStore: SecretStore,
  webhookSecretKey: string,
  force: boolean
): Promise<string | null> {
  const init = force ? { force: true } : undefined;
  const raw = (
    await secretStore.getOptional(webhookSecretKey, init)
  )?.readSecretValue();
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function constructStripeEventSelfHealing(args: {
  readonly stripe: Stripe;
  readonly secretStore: SecretStore;
  readonly webhookSecretKey: string;
  readonly raw: string;
  readonly signature: string;
}): Promise<Stripe.Event | { readonly missingSecret: true }> {
  const { stripe, secretStore, webhookSecretKey, raw, signature } = args;
  const cryptoProvider = Stripe.createSubtleCryptoProvider();

  const cachedSecret = await readWebhookSecret(
    secretStore,
    webhookSecretKey,
    false
  );
  let firstAttemptError: unknown = null;
  if (cachedSecret !== null) {
    try {
      return await stripe.webhooks.constructEventAsync(
        raw,
        signature,
        cachedSecret,
        undefined,
        cryptoProvider
      );
    } catch (e: unknown) {
      if (!(e instanceof Stripe.errors.StripeSignatureVerificationError)) {
        throw e;
      }
      firstAttemptError = e;
    }
  }

  const freshSecret = await readWebhookSecret(
    secretStore,
    webhookSecretKey,
    true
  );
  if (freshSecret === null) {
    return { missingSecret: true };
  }
  if (freshSecret === cachedSecret && firstAttemptError !== null) {
    throw firstAttemptError;
  }
  return await stripe.webhooks.constructEventAsync(
    raw,
    signature,
    freshSecret,
    undefined,
    cryptoProvider
  );
}

export function createStripeWebhookRoutes(args: {
  readonly secretStore: SecretStore;
  readonly stripe: Stripe | null;
  readonly getSqlClient: () => SqlClient;
  readonly webhookSecretKey: string;
}) {
  const { secretStore, stripe, getSqlClient, webhookSecretKey } = args;

  return new Hono().post('/stripe/webhook', async (c) => {
    try {
      if (stripe === null) {
        return c.json({ error: 'Stripe is not configured' }, 503);
      }

      const sig = c.req.header('stripe-signature') ?? '';
      const raw = await c.req.text();

      const result = await constructStripeEventSelfHealing({
        stripe,
        secretStore,
        webhookSecretKey,
        raw,
        signature: sig,
      });
      if ('missingSecret' in result) {
        log.error('stripe webhook: signing secret missing from secret store');
        return c.json(
          { error: 'Stripe webhook secret is not configured' },
          503
        );
      }

      const event = result;
      const objectId = stripeEventObjectId(event);

      await recordVerifiedStripeWebhookInEntityStore(
        getSqlClient(),
        event,
        objectId
      );

      return c.json({ received: true as const }, 200);
    } catch (e: unknown) {
      if (e instanceof Stripe.errors.StripeSignatureVerificationError) {
        log.warn('stripe webhook: signature verification failed', {
          error: e.message,
        });
        return c.json({ error: e.message }, 400);
      }
      throw e;
    }
  });
}
