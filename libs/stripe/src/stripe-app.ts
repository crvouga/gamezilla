import type { EntityDb } from '@gamezilla/lib/entity-db/interface';
import type { SecretStore } from '@gamezilla/lib/secret-store';
import type { PatchesDb } from '@gamezilla/patch-db/interface';
import { Hono } from 'hono';
import type Stripe from 'stripe';
import {
  createStripeCheckoutRoutes,
  type StripeRequireAuth,
} from './stripe-checkout-route';
import { createStripeWebhookRoutes } from './stripe-webhook-route';

/**
 * Stripe HTTP surface for the API Worker: webhook + checkout + portal.
 * Mount at `/` on a parent app that already defines Worker `Bindings`.
 */
export function createStripeApp(args: {
  readonly db: PatchesDb;
  readonly secretStore: SecretStore;
  readonly stripe: Stripe | null;
  readonly entityDb: EntityDb;
  readonly requireAuth: StripeRequireAuth;
  /** Doppler secret name for the webhook signing secret. */
  readonly webhookSecretDopplerKey: string;
}) {
  const webhook = createStripeWebhookRoutes({
    secretStore: args.secretStore,
    stripe: args.stripe,
    entityDb: args.entityDb,
    webhookSecretKey: args.webhookSecretDopplerKey,
  });
  const checkout = createStripeCheckoutRoutes({
    db: args.db,
    stripe: args.stripe,
    entityDb: args.entityDb,
    requireAuth: args.requireAuth,
  });

  return new Hono().route('/', webhook).route('/', checkout);
}
