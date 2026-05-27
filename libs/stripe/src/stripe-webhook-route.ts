import { createLogger } from '@pkgs/logger';
import type { SecretStore } from '@pkgs/secret-store';
import type { PatchDb } from '@pkgs/patch-db/interface';
import { patchDbSystemContext } from '@pkgs/patch-db/interface';
import { PatchMetaAttr } from '@pkgs/patch-db/metadata/patch-metadata';
import { PATCH_DB_SYSTEM_DEVICE_ID } from '@pkgs/patch-db/policy/system-device';
import { Hono } from 'hono';
import Stripe from 'stripe';
import { stripeEventObjectId } from './event-object-id';
import { resolveAccountIdByStripeCustomerId } from './resolve-account-by-stripe-customer';
import { StripeAttr, StripeEntityAttr } from './stripe-attrs';

/** Stripe webhook handler — bypasses ABAC like other system contexts. */
const PATCHES_DB_STRIPE_WEBHOOK_CONTEXT =
  patchDbSystemContext('stripe-webhook');

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

/** Stripe event types use `_`; entity types use kebab segments after `stripe.`. */
function webhookEventEntityType(eventType: string): string {
  return `stripe.${eventType.replace(/_/g, '-')}`;
}

async function recordVerifiedStripeWebhookInPatchDb(
  patchDb: PatchDb,
  event: Stripe.Event,
  objectId: string
): Promise<void> {
  const customerId = extractStripeCustomerId(event);
  let accountId: string | null = null;
  if (customerId !== null) {
    accountId = await resolveAccountIdByStripeCustomerId(
      patchDb,
      customerId,
      PATCHES_DB_STRIPE_WEBHOOK_CONTEXT
    );
  }

  const eventCacheAttrs: Record<string, unknown> = {
    ...StripeAttr.payload(event as unknown),
    ...StripeAttr.objectType('event'),
    ...StripeAttr.source('stripe_webhook'),
    ...PatchMetaAttr.createdById(PATCH_DB_SYSTEM_DEVICE_ID),
  };
  if (accountId !== null) {
    Object.assign(eventCacheAttrs, StripeEntityAttr.owner(accountId));
  }

  const patches: Parameters<PatchDb['write']>[0] = [
    {
      entityId: objectId,
      entityType: webhookEventEntityType(event.type),
      attributes: eventCacheAttrs,
    },
  ];

  if (accountId !== null) {
    patches.push({
      entityId: objectId,
      entityType: 'stripe.webhook-event',
      attributes: {
        ...StripeEntityAttr.owner(accountId),
        ...StripeAttr.webhookEventType(event.type),
        ...StripeAttr.stripeObjectId(objectId),
        ...PatchMetaAttr.createdById(PATCH_DB_SYSTEM_DEVICE_ID),
      },
    });
  }

  await patchDb.write(patches, PATCHES_DB_STRIPE_WEBHOOK_CONTEXT);
}

export function createStripeWebhookRoutes(args: {
  readonly secretStore: SecretStore;
  readonly stripe: Stripe | null;
  readonly getPatchDb: () => PatchDb;
  readonly webhookSecretKey: string;
}) {
  const { secretStore, stripe, getPatchDb, webhookSecretKey } = args;

  return new Hono().post('/stripe/webhook', async (c) => {
    try {
      if (stripe === null) {
        return c.json({ error: 'Stripe is not configured' }, 503);
      }

      const sig = c.req.header('stripe-signature') ?? '';
      const raw = await c.req.text();

      const webhookSecret = (
        await secretStore.getOptional(webhookSecretKey)
      )?.readSecretValue();
      if (
        typeof webhookSecret !== 'string' ||
        webhookSecret.trim().length === 0
      ) {
        log.error('stripe webhook: signing secret missing from secret store');
        return c.json(
          { error: 'Stripe webhook secret is not configured' },
          503
        );
      }

      const event = await stripe.webhooks.constructEventAsync(
        raw,
        sig,
        webhookSecret.trim(),
        undefined,
        Stripe.createSubtleCryptoProvider()
      );
      const objectId = stripeEventObjectId(event);

      await recordVerifiedStripeWebhookInPatchDb(getPatchDb(), event, objectId);

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
