import type { EntityDb } from '@gamezilla/lib/entity-db/interface';
import { createLogger } from '@gamezilla/lib/logger';
import type { SecretStore } from '@gamezilla/lib/secret-store';
import { Hono } from 'hono';
import Stripe from 'stripe';
import { stripeEventObjectId } from './event-object-id';

const log = createLogger({ name: 'stripe:webhook' });

export function createStripeWebhookRoutes(args: {
  readonly secretStore: SecretStore;
  readonly stripe: Stripe | null;
  readonly entityDb: EntityDb;
  readonly webhookSecretKey: string;
}) {
  const { secretStore, stripe, entityDb, webhookSecretKey } = args;

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

      await entityDb.upsert({
        namespace: 'stripe',
        type: event.type,
        id: objectId,
        data: event,
      });

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
