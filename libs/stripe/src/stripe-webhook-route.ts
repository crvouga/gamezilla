import { createLogger } from '@gamezilla/lib/logger';
import type { SecretStore } from '@gamezilla/lib/secret-store';
import type {
  PatchesDb,
  PatchesDbSystemContext,
} from '@gamezilla/patch-db/interface';
import { PATCH_DB_SYSTEM_PRINCIPAL_ID } from '@gamezilla/patch-db/policy/system-principal';
import { Hono } from 'hono';
import Stripe from 'stripe';
import { stripeEventObjectId } from './event-object-id';
import { resolveAccountIdByStripeCustomerId } from './resolve-account-by-stripe-customer';

/** Stripe webhook handler — bypasses ABAC like other system contexts. */
const PATCHES_DB_STRIPE_WEBHOOK_CONTEXT: PatchesDbSystemContext = {
  principalId: null,
  reason: 'stripe-webhook',
};

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

function webhookEventEntityType(eventType: string): string {
  return `stripe.${eventType}`;
}

async function recordVerifiedStripeWebhookInPatchDb(
  patchDb: PatchesDb,
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
    'stripe/payload': event as unknown,
    'stripe/objectType': 'event',
    'stripe/source': 'stripe_webhook',
    'patch/createdBy': PATCH_DB_SYSTEM_PRINCIPAL_ID,
  };
  if (accountId !== null) {
    eventCacheAttrs['entity/owner'] = accountId;
  }

  const patches: Parameters<PatchesDb['write']>[0] = [
    {
      entityId: objectId,
      entityType: webhookEventEntityType(event.type),
      attributes: eventCacheAttrs,
    },
  ];

  if (accountId !== null) {
    patches.push({
      entityId: objectId,
      entityType: 'stripe.webhook_event',
      attributes: {
        'entity/owner': accountId,
        'stripe/webhookEventType': event.type,
        'stripe/stripeObjectId': objectId,
        'patch/createdBy': PATCH_DB_SYSTEM_PRINCIPAL_ID,
      },
    });
  }

  await patchDb.write(patches, PATCHES_DB_STRIPE_WEBHOOK_CONTEXT);
}

export function createStripeWebhookRoutes(args: {
  readonly secretStore: SecretStore;
  readonly stripe: Stripe | null;
  readonly patchDb: PatchesDb;
  readonly webhookSecretKey: string;
}) {
  const { secretStore, stripe, patchDb, webhookSecretKey } = args;

  return new Hono().post('/stripe/webhook', async (c) => {
    try {
      if (stripe === null) {
        return c.json({ error: 'Stripe is not configured' }, 503);
      }

      const sig = c.req.header('stripe-signature') ?? '';
      const raw = await c.req.text();

      const webhookSecret = await secretStore.getOptional(webhookSecretKey);
      if (webhookSecret === null || webhookSecret.trim().length === 0) {
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

      await recordVerifiedStripeWebhookInPatchDb(patchDb, event, objectId);

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
