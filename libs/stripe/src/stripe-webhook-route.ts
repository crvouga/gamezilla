import type { SecretStore } from '@gamezilla/lib/secret-store';
import type { EntityDb } from '@gamezilla/lib/entity-db/interface';
import { createLogger } from '@gamezilla/lib/logger';
import { Hono } from 'hono';
import Stripe from 'stripe';
import { stripeEventObjectId } from './event-object-id';

const log = createLogger({ name: 'stripe:webhook' });

export function createStripeWebhookRoutes(args: {
  readonly secretStore: SecretStore;
  readonly stripe: Stripe | null;
  readonly stripeCache: EntityDb<unknown>;
  /** Doppler secret name (e.g. `STRIPE_WEBHOOK_SECRET`). */
  readonly webhookSecretDopplerKey: string;
}) {
  const { secretStore, stripe, stripeCache, webhookSecretDopplerKey } = args;

  return new Hono().post('/stripe/webhook', async (c) => {
    if (stripe === null) {
      return c.json({ error: 'Stripe is not configured' }, 503);
    }

    const sig = c.req.header('stripe-signature') ?? '';
    const raw = await c.req.text();

    const webhookSecret = await secretStore.getOptional(webhookSecretDopplerKey);
    if (webhookSecret === null || webhookSecret.trim().length === 0) {
      log.error('stripe webhook: signing secret missing from secret store');
      return c.json({ error: 'Stripe webhook secret is not configured' }, 503);
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        raw,
        sig,
        webhookSecret.trim(),
        undefined,
        Stripe.createSubtleCryptoProvider()
      );
    } catch (e: unknown) {
      if (e instanceof Stripe.errors.StripeSignatureVerificationError) {
        log.warn('stripe webhook: signature verification failed', {
          error: e.message,
        });
        return c.json({ error: e.message }, 400);
      }
      throw e;
    }

    const objectId = stripeEventObjectId(event);
    await stripeCache.upsert({
      namespace: 'stripe',
      type: event.type,
      id: objectId,
      data: event.data.object,
      metadata: {
        event_id: event.id,
        livemode: event.livemode,
        api_version: event.api_version,
        event_created: event.created,
      },
    });

    return c.json({ received: true as const }, 200);
  });
}
